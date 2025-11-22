// Supabase Edge Function for PartyHire orders & inventory
// Deploy as functions/partyhire/index.ts in your Supabase project.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-org-slug',
};

type PartyHirePayload = {
  action: string;
  orgSlug?: string;
  order?: Record<string, unknown>;
  status?: string;
  returns?: Record<string, number>;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Supabase environment variables are not set for partyhire edge.');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = (await req.json()) as PartyHirePayload;
    const action = body?.action;
    if (!action) return json({ error: 'Action is required' }, 400);

    const orgSlug = (req.headers.get('x-org-slug') ?? body.orgSlug ?? 'public').toLowerCase();

    const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    let result: unknown;
    switch (action) {
      case 'list':
        result = await listData(client, orgSlug);
        break;
      case 'create_order':
        result = await createOrder(
          client,
          orgSlug,
          (body.order as Record<string, unknown> | undefined) ?? {},
        );
        break;
      case 'update_status':
        result = await updateStatus(
          client,
          orgSlug,
          (body.order as Record<string, unknown> | undefined) ?? {},
        );
        break;
      case 'record_return':
        result = await recordReturn(
          client,
          orgSlug,
          (body.order as Record<string, unknown> | undefined) ?? {},
          body.returns ?? {},
        );
        break;
      case 'regenerate_calendar':
        result = await regenerateCalendar(
          client,
          orgSlug,
          (body.order as Record<string, unknown> | undefined) ?? {},
        );
        break;
      default:
        return json({ error: `Unsupported action: ${action}` }, 400);
    }

    return json(result ?? { ok: true });
  } catch (error) {
    console.error('PartyHire edge error', error);
    return json({ error: error?.message ?? 'Unexpected error' }, 500);
  }
});

async function listData(client: ReturnType<typeof createClient>, orgSlug: string) {
  const [inventory, orders] = await Promise.all([
    client.from('partyhire_inventory_view').select('*').eq('org_slug', orgSlug),
    client
      .from('partyhire_orders')
      .select(
        `*, items:partyhire_order_items(id, stock_id, quantity, returned_quantity, unit_price, line_total, stock:partyhire_inventory!partyhire_order_items_stock_id_fkey(name, sku))`,
      )
      .eq('org_slug', orgSlug)
      .order('created_at', { ascending: false }),
  ]);

  if (inventory.error) throw inventory.error;
  if (orders.error) throw orders.error;

  return {
    ok: true,
    inventory: (inventory.data ?? []).map(mapInventory),
    orders: (orders.data ?? []).map(mapOrder),
  };
}

async function createOrder(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  order: Record<string, unknown>,
) {
  const now = new Date();
  const count = await client
    .from('partyhire_orders')
    .select('id', { count: 'exact', head: true })
    .eq('org_slug', orgSlug);
  if (count.error) throw count.error;

  const reference = buildReference(now, (count.count ?? 0) + 1);
  const quoteNumber = buildQuoteNumber(now, (count.count ?? 0) + 101);
  const invoiceNumber = buildInvoiceNumber(now, (count.count ?? 0) + 501);

  const recipients = Array.isArray(order['recipients'])
    ? (order['recipients'] as string[])
    : typeof order['recipients'] === 'string'
      ? String(order['recipients'])
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
      : [];

  const items = Array.isArray(order['items'])
    ? (order['items'] as Record<string, unknown>[])
    : [];

  const stockIds = items.map((item) => Number(item['stockId'])).filter((id) => Number.isFinite(id));
  const stockLookup = await client
    .from('partyhire_inventory')
    .select('id, name, unit_price')
    .eq('org_slug', orgSlug)
    .in('id', stockIds);
  if (stockLookup.error) throw stockLookup.error;

  const priceById = new Map<number, { name: string; unit_price: number }>();
  for (const row of stockLookup.data ?? []) {
    priceById.set(Number(row.id), {
      name: String(row.name ?? ''),
      unit_price: Number(row.unit_price ?? 0),
    });
  }

  const stockRows = items.map((item) => ({
    stock_id: Number(item['stockId']),
    name: priceById.get(Number(item['stockId']))?.name ?? String(item['name'] ?? ''),
    quantity: Number(item['quantity'] ?? 0),
    unit_price: priceById.get(Number(item['stockId']))?.unit_price ?? Number(item['unitPrice'] ?? 0),
    returned_quantity: 0,
    line_total:
      Number(item['quantity'] ?? 0) *
      (priceById.get(Number(item['stockId']))?.unit_price ?? Number(item['unitPrice'] ?? 0)),
  }));

  const subtotal = stockRows.reduce((sum, row) => sum + row.line_total, 0);
  const gst = subtotal * 0.15;
  const total = subtotal + gst;

  const { data, error } = await client
    .from('partyhire_orders')
    .insert({
      org_slug: orgSlug,
      reference,
      quote_number: quoteNumber,
      invoice_number: invoiceNumber,
      customer_name: String(order['customerName'] ?? ''),
      contact_email: String(order['contactEmail'] ?? ''),
      contact_phone: order['contactPhone'] ? String(order['contactPhone']) : null,
      event_name: String(order['eventName'] ?? ''),
      start_date: order['startDate'] ?? now.toISOString(),
      end_date: order['endDate'] ?? now.toISOString(),
      location: String(order['location'] ?? ''),
      delivery_method: (order['deliveryMethod'] as string) ?? 'pickup',
      notes: order['notes'] ? String(order['notes']) : null,
      recipients,
      status: 'Prepped',
      subtotal,
      gst,
      total,
    })
    .select('*, items:partyhire_order_items(*)')
    .single();

  if (error) throw error;
  const orderId = data?.id;

  if (orderId) {
    const insertItems = await client
      .from('partyhire_order_items')
      .insert(stockRows.map((row) => ({ ...row, order_id: orderId })));
    if (insertItems.error) throw insertItems.error;

    await adjustAllocations(client, orgSlug, stockRows, +1);
  }

  const mapped = mapOrder({ ...data, items: stockRows });
  mapped.calendarEvent = buildCalendarEvent(mapped);

  return { ok: true, order: mapped };
}

async function updateStatus(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  order: Record<string, unknown>,
) {
  const orderId = String(order['id'] ?? '');
  const status = String(order['status'] ?? '');
  if (!orderId || !status) throw new Error('Missing order id or status');

  const { error } = await client
    .from('partyhire_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('org_slug', orgSlug);
  if (error) throw error;

  const refreshed = await listData(client, orgSlug);
  return { ok: true, orders: refreshed.orders };
}

async function recordReturn(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  order: Record<string, unknown>,
  returns: Record<string, number>,
) {
  const orderId = String(order['id'] ?? '');
  if (!orderId) throw new Error('Missing order id');

  const { data, error } = await client
    .from('partyhire_order_items')
    .select('*')
    .eq('order_id', orderId);
  if (error) throw error;

  const updatedRows = (data ?? []).map((row) => ({
    id: row.id,
    stock_id: row.stock_id,
    quantity: row.quantity,
    returned_quantity: Math.min(row.quantity, Number(returns?.[row.stock_id] ?? 0)),
    unit_price: row.unit_price,
    line_total: row.line_total,
  }));

  for (const row of updatedRows) {
    await client
      .from('partyhire_order_items')
      .update({ returned_quantity: row.returned_quantity })
      .eq('id', row.id);
  }

  await adjustAllocations(
    client,
    orgSlug,
    updatedRows.map((row) => ({ stock_id: row.stock_id, quantity: row.returned_quantity })),
    -1,
  );

  const status = String(order['status'] ?? 'Returned');
  await client
    .from('partyhire_orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('org_slug', orgSlug);

  const refreshed = await listData(client, orgSlug);
  return { ok: true, orders: refreshed.orders };
}

async function regenerateCalendar(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  order: Record<string, unknown>,
) {
  const orderId = String(order['id'] ?? '');
  const { data, error } = await client
    .from('partyhire_orders')
    .select(
      `*, items:partyhire_order_items(id, stock_id, quantity, returned_quantity, unit_price, line_total, stock:partyhire_inventory!partyhire_order_items_stock_id_fkey(name, sku))`,
    )
    .eq('id', orderId)
    .eq('org_slug', orgSlug)
    .single();
  if (error) throw error;

  const mapped = mapOrder(data);
  mapped.calendarEvent = buildCalendarEvent(mapped);
  return { ok: true, order: mapped };
}

async function adjustAllocations(
  client: ReturnType<typeof createClient>,
  orgSlug: string,
  rows: { stock_id: number; quantity: number }[],
  multiplier: 1 | -1,
) {
  for (const row of rows) {
    await client.rpc('partyhire_adjust_allocation', {
      target_org: orgSlug,
      stock_id: row.stock_id,
      delta: (row.quantity ?? 0) * multiplier,
    });
  }
}

function mapInventory(row: Record<string, unknown>) {
  return {
    id: Number(row['id']),
    sku: String(row['sku'] ?? ''),
    name: String(row['name'] ?? ''),
    category: String(row['category'] ?? 'General'),
    description: (row['description'] as string | null) ?? undefined,
    total: Number(row['total_quantity'] ?? 0),
    allocated: Number(row['allocated_quantity'] ?? 0),
    available: Number(row['available_quantity'] ?? 0),
    unitPrice: Number(row['unit_price'] ?? 0),
  };
}

function mapOrder(row: Record<string, unknown>) {
  const itemsRaw = (row['items'] as Record<string, unknown>[] | null) ?? [];
  const items = itemsRaw.map((item) => ({
    stockId: Number(item['stock_id']),
    name: String(item['stock']?.['name'] ?? item['name'] ?? ''),
    quantity: Number(item['quantity'] ?? 0),
    unitPrice: Number(item['unit_price'] ?? 0),
    returnedQuantity: Number(item['returned_quantity'] ?? 0),
  }));

  return {
    id: String(row['id']),
    reference: String(row['reference'] ?? ''),
    quoteNumber: String(row['quote_number'] ?? ''),
    invoiceNumber: String(row['invoice_number'] ?? ''),
    customerName: String(row['customer_name'] ?? ''),
    contactEmail: String(row['contact_email'] ?? ''),
    contactPhone: (row['contact_phone'] as string | null) ?? undefined,
    eventName: String(row['event_name'] ?? ''),
    startDate: String(row['start_date'] ?? ''),
    endDate: String(row['end_date'] ?? ''),
    location: String(row['location'] ?? ''),
    deliveryMethod: String(row['delivery_method'] ?? 'pickup') as 'pickup' | 'delivery',
    notes: (row['notes'] as string | null) ?? undefined,
    recipients: ((row['recipients'] as string[]) ?? []).map(String),
    items,
    totals: {
      subtotal: Number(row['subtotal'] ?? 0),
      gst: Number(row['gst'] ?? 0),
      total: Number(row['total'] ?? 0),
    },
    status: String(row['status'] ?? 'Prepped'),
    calendarEvent: buildCalendarEventFromRow(row),
    createdAt: String(row['created_at'] ?? ''),
    returnedItems: items.reduce(
      (acc, item) => ({ ...acc, [item.stockId]: item.returnedQuantity ?? 0 }),
      {} as Record<number, number>,
    ),
  };
}

function buildReference(now: Date, sequence: number) {
  const datePart = now.toISOString().slice(0, 10).replaceAll('-', '');
  return `PH-${datePart}-${String(sequence).padStart(3, '0')}`;
}

function buildQuoteNumber(now: Date, sequence: number) {
  return `Q-PH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(sequence)}`;
}

function buildInvoiceNumber(now: Date, sequence: number) {
  return `INV-PH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(sequence)}`;
}

function buildCalendarEvent(order: ReturnType<typeof mapOrder>) {
  return buildCalendarEventFromRow({
    event_name: order.eventName,
    reference: order.reference,
    start_date: order.startDate,
    end_date: order.endDate,
    location: order.location,
    recipients: order.recipients,
    customer_name: order.customerName,
    contact_email: order.contactEmail,
    delivery_method: order.deliveryMethod,
    total: order.totals.total,
    notes: order.notes,
  });
}

function buildCalendarEventFromRow(row: Record<string, unknown>) {
  const summary = `PartyHire: ${row['event_name'] ?? 'Event'} (${row['reference'] ?? ''})`;
  const description = [
    `Reference: ${row['reference'] ?? ''}`,
    `Customer: ${row['customer_name'] ?? ''} (${row['contact_email'] ?? ''})`,
    `Event: ${row['event_name'] ?? ''}`,
    `Location: ${row['location'] ?? ''}`,
    `Delivery: ${(row['delivery_method'] ?? 'pickup').toString().toUpperCase()}`,
    `Hire total: $${Number(row['total'] ?? 0).toFixed(2)}`,
    row['notes'] ? `Notes: ${row['notes']}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const start = toCalendarDate(String(row['start_date'] ?? new Date().toISOString()));
  const end = toCalendarDate(String(row['end_date'] ?? new Date().toISOString()));
  const attendees = ((row['recipients'] as string[]) ?? []).join(',');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: summary,
    dates: `${start}/${end}`,
    details: description,
    location: String(row['location'] ?? ''),
    add: attendees,
  });

  return {
    summary,
    start: String(row['start_date'] ?? ''),
    end: String(row['end_date'] ?? ''),
    location: String(row['location'] ?? ''),
    description,
    attendees: ((row['recipients'] as string[]) ?? []).map(String),
    googleCalendarUrl: `https://calendar.google.com/calendar/render?${params.toString()}`,
  };
}

function toCalendarDate(date: string): string {
  const value = new Date(date);
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = value.getUTCFullYear();
  const month = pad(value.getUTCMonth() + 1);
  const day = pad(value.getUTCDate());
  const hours = pad(value.getUTCHours());
  const minutes = pad(value.getUTCMinutes());
  const seconds = pad(value.getUTCSeconds());
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders },
  });
}
