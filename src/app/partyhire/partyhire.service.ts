import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { SupabaseService } from '../shared/supabase-service/supabase.service';
import {
  NewPartyHireOrder,
  PartyHireCalendarEvent,
  PartyHireOrder,
  PartyHireOrderItem,
  PartyHireOrderStatus,
  PartyHireStockItem,
} from './partyhire.models';

const DEFAULT_STOCK: PartyHireStockItem[] = [
  {
    id: 1,
    sku: 'PH-FTS-BAT-20',
    name: 'Battery Festoon Kit (20m)',
    category: 'Lighting',
    total: 12,
    allocated: 2,
    unitPrice: 95,
    description: 'Portable LED festoons with clip-in batteries.',
  },
  {
    id: 2,
    sku: 'PH-FTS-PWR-20',
    name: 'Corded Festoon Kit (20m)',
    category: 'Lighting',
    total: 10,
    allocated: 1,
    unitPrice: 75,
    description: 'Mains-powered festoons with inline dimmers.',
  },
  {
    id: 3,
    sku: 'PH-UPLT-RGB-64',
    name: 'Par 64 RGB Uplight',
    category: 'Lighting',
    total: 30,
    allocated: 12,
    unitPrice: 35,
    description: 'Battery uplights with IR remote and colour macros.',
  },
  {
    id: 4,
    sku: 'PH-SPKR-BAT-12',
    name: 'Portable Speaker (Battery)',
    category: 'Audio',
    total: 16,
    allocated: 3,
    unitPrice: 80,
    description: 'Bluetooth enabled battery PA with 2 wireless mics.',
  },
  {
    id: 5,
    sku: 'PH-TRUSS-2M',
    name: '2m Box Truss',
    category: 'Theming',
    total: 24,
    allocated: 8,
    unitPrice: 55,
    description: 'Aluminium box truss lengths for small installs.',
  },
];

interface PartyHireListResponse {
  ok: boolean;
  inventory?: ApiInventory[];
  orders?: ApiOrder[];
  error?: string;
}

interface PartyHireMutationResponse {
  ok: boolean;
  order?: ApiOrder;
  orders?: ApiOrder[];
  error?: string;
}

interface ApiInventory {
  id: number;
  sku?: string;
  name: string;
  category: string;
  description?: string | null;
  total: number;
  allocated: number;
  available?: number;
  unitPrice: number;
}

interface ApiOrderItem {
  stockId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  returnedQuantity?: number;
}

interface ApiOrder {
  id: string;
  reference: string;
  quoteNumber: string;
  invoiceNumber: string;
  customerName: string;
  contactEmail: string;
  contactPhone?: string;
  eventName: string;
  startDate: string;
  endDate: string;
  location: string;
  deliveryMethod: 'pickup' | 'delivery';
  notes?: string;
  recipients: string[];
  items: ApiOrderItem[];
  totals: { subtotal: number; gst: number; total: number };
  status: PartyHireOrderStatus;
  calendarEvent: PartyHireCalendarEvent;
  createdAt: string;
  returnedItems?: Record<number, number>;
}

@Injectable({ providedIn: 'root' })
export class PartyHireService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  private readonly anonKey = environment.supabaseKey ?? '';
  private readonly baseUrl = this.buildBaseUrl();
  private readonly origin = this.resolveOrigin();

  private readonly fallbackStock: PartyHireStockItem[] = structuredClone(DEFAULT_STOCK);
  private readonly fallbackOrders: PartyHireOrder[] = [];
  private lastFetched: { inventory: PartyHireStockItem[]; orders: PartyHireOrder[] } | null = null;

  async listStock(): Promise<PartyHireStockItem[]> {
    const remote = await this.listAll();
    if (remote?.inventory?.length) {
      this.lastFetched = remote;
      return remote.inventory;
    }

    if (this.lastFetched?.inventory?.length) return this.lastFetched.inventory;

    return this.fallbackStock.map((item) => ({ ...item, available: item.total - item.allocated }));
  }

  async listOrders(): Promise<PartyHireOrder[]> {
    const remote = await this.listAll();
    if (remote?.orders?.length) {
      this.lastFetched = remote;
      return remote.orders;
    }

    if (this.lastFetched?.orders?.length) return this.lastFetched.orders;

    return this.fallbackOrders.map((order) => ({ ...order }));
  }

  async createOrder(payload: NewPartyHireOrder): Promise<PartyHireOrder> {
    const sessionOrder = await this.request<PartyHireMutationResponse>('create_order', {
      ...payload,
      items: payload.items.map((item) => ({
        ...item,
        unitPrice: this.getFallbackUnitPrice(item.stockId),
      })),
    });

    if (sessionOrder?.ok && sessionOrder.order) {
      return this.mapOrder(sessionOrder.order);
    }

    // Fallback to local state
    const order = this.buildLocalOrder(payload);
    this.fallbackOrders.unshift(order);
    this.reserveStock(order.items);
    return { ...order };
  }

  async updateStatus(orderId: string, status: PartyHireOrderStatus): Promise<void> {
    const response = await this.request<PartyHireMutationResponse>('update_status', {
      id: orderId,
      status,
    });

    if (response?.ok) {
      this.lastFetched = null;
      return;
    }

    const local = this.findLocalOrder(orderId);
    local.status = status;
  }

  async recordReturn(
    orderId: string,
    returnedItems: Record<number, number>,
    status: PartyHireOrderStatus,
  ): Promise<void> {
    const response = await this.request<PartyHireMutationResponse>('record_return', {
      id: orderId,
      status,
    }, returnedItems);

    if (response?.ok) {
      this.lastFetched = null;
      return;
    }

    const order = this.findLocalOrder(orderId);
    const releaseItems = order.items.map((item) => ({
      ...item,
      quantity: Math.min(item.quantity, returnedItems[item.stockId] ?? 0),
    }));
    this.releaseStock(releaseItems);
    order.status = status;
    order.returnedItems = returnedItems;
  }

  async regenerateCalendar(orderId: string): Promise<void> {
    await this.request<PartyHireMutationResponse>('regenerate_calendar', { id: orderId });
    this.lastFetched = null;
  }

  private async listAll(): Promise<{ inventory: PartyHireStockItem[]; orders: PartyHireOrder[] } | null> {
    try {
      const response = await this.request<PartyHireListResponse>('list');
      if (!response?.ok) return null;
      return {
        inventory: (response.inventory ?? []).map((item) => this.mapInventory(item)),
        orders: (response.orders ?? []).map((order) => this.mapOrder(order)),
      };
    } catch (error) {
      console.warn('PartyHire: falling back to local data', error);
      return null;
    }
  }

  private mapInventory(item: ApiInventory): PartyHireStockItem {
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      category: item.category,
      description: item.description ?? undefined,
      total: item.total,
      allocated: item.allocated,
      unitPrice: item.unitPrice,
      available: item.available ?? Math.max(0, item.total - item.allocated),
    };
  }

  private mapOrder(order: ApiOrder): PartyHireOrder {
    return {
      ...order,
      items: order.items.map((item) => ({ ...item })),
      returnedItems: order.returnedItems ?? {},
    };
  }

  private buildLocalOrder(payload: NewPartyHireOrder): PartyHireOrder {
    const now = new Date();
    const reference = this.buildReference(now);
    const quoteNumber = this.buildQuoteNumber(now);
    const invoiceNumber = this.buildInvoiceNumber(now);

    const items: PartyHireOrderItem[] = payload.items.map((item) => {
      const stock = this.getStock(item.stockId);
      return {
        stockId: item.stockId,
        name: stock?.name ?? 'Unknown item',
        quantity: item.quantity,
        unitPrice: stock?.unitPrice ?? 0,
      };
    });

    const totals = this.calculateTotals(items);
    const calendarEvent = this.buildCalendarEvent(payload, reference, totals.total);

    return {
      id: crypto.randomUUID(),
      reference,
      quoteNumber,
      invoiceNumber,
      customerName: payload.customerName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      eventName: payload.eventName,
      startDate: payload.startDate,
      endDate: payload.endDate,
      location: payload.location,
      deliveryMethod: payload.deliveryMethod,
      notes: payload.notes,
      recipients: payload.recipients,
      items,
      totals,
      status: 'Prepped',
      calendarEvent,
      createdAt: now.toISOString(),
    };
  }

  private buildReference(now: Date): string {
    const datePart = now.toISOString().slice(0, 10).replaceAll('-', '');
    const sequence = String(this.fallbackOrders.length + 1).padStart(3, '0');
    return `PH-${datePart}-${sequence}`;
  }

  private buildQuoteNumber(now: Date): string {
    return `Q-PH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
      this.fallbackOrders.length + 101
    }`;
  }

  private buildInvoiceNumber(now: Date): string {
    return `INV-PH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
      this.fallbackOrders.length + 501
    }`;
  }

  private calculateTotals(items: PartyHireOrderItem[]) {
    const subtotal = items.reduce((total, item) => total + item.quantity * item.unitPrice, 0);
    const gst = subtotal * 0.15;
    const total = subtotal + gst;

    return { subtotal, gst, total };
  }

  private buildCalendarEvent(
    payload: NewPartyHireOrder,
    reference: string,
    total: number,
  ): PartyHireCalendarEvent {
    const summary = `PartyHire: ${payload.eventName} (${reference})`;
    const description = this.calendarDescription(payload, reference, total);
    const googleCalendarUrl = this.googleCalendarUrl(
      payload.startDate,
      payload.endDate,
      summary,
      description,
      payload.location,
      payload.recipients,
    );

    return {
      summary,
      start: payload.startDate,
      end: payload.endDate,
      location: payload.location,
      description,
      attendees: payload.recipients,
      googleCalendarUrl,
    };
  }

  private calendarDescription(payload: NewPartyHireOrder, reference: string, total: number): string {
    return [
      `Reference: ${reference}`,
      `Customer: ${payload.customerName} (${payload.contactEmail})`,
      `Event: ${payload.eventName}`,
      `Location: ${payload.location}`,
      `Delivery: ${payload.deliveryMethod.toUpperCase()}`,
      `Hire total: $${total.toFixed(2)}`,
      payload.notes ? `Notes: ${payload.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private googleCalendarUrl(
    startIso: string,
    endIso: string,
    summary: string,
    description: string,
    location: string,
    attendees: string[],
  ): string {
    const start = this.toCalendarDate(startIso);
    const end = this.toCalendarDate(endIso);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: summary,
      dates: `${start}/${end}`,
      details: description,
      location,
      add: attendees.join(','),
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  private toCalendarDate(date: string): string {
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

  private reserveStock(items: PartyHireOrderItem[]): void {
    for (const item of items) {
      const stock = this.getStock(item.stockId);
      if (stock) stock.allocated += item.quantity;
    }
  }

  private releaseStock(items: PartyHireOrderItem[]): void {
    for (const item of items) {
      const stock = this.getStock(item.stockId);
      if (!stock) continue;
      stock.allocated = Math.max(0, stock.allocated - item.quantity);
    }
  }

  private getStock(stockId: number): PartyHireStockItem | undefined {
    return this.fallbackStock.find((item) => item.id === stockId);
  }

  private getFallbackUnitPrice(stockId: number): number {
    return this.getStock(stockId)?.unitPrice ?? 0;
  }

  private findLocalOrder(orderId: string): PartyHireOrder {
    const order = this.fallbackOrders.find((existing) => existing.id === orderId);
    if (!order) throw new Error('Order not found');
    return order;
  }

  private resolveOrigin(): string | undefined {
    try {
      return typeof window !== 'undefined' ? window.location.origin : undefined;
    } catch (error) {
      console.warn('PartyHire: unable to read window origin', error);
      return undefined;
    }
  }

  private buildBaseUrl(): string {
    const root = environment.supabaseDataUrl.replace(/\/+$/, '');
    const fn = environment.partyHireEdgeFunction ?? 'partyhire';
    return `${root}/functions/v1/${fn}`;
  }

  private async request<T extends { ok: boolean; error?: string }>(
    action: string,
    order?: unknown,
    returns?: Record<number, number>,
  ): Promise<T | null> {
    const { data } = await this.supabaseService.client.auth.getSession();
    const accessToken = data.session?.access_token;

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-org-slug': this.authService.orgSlug,
      ...(this.origin ? { origin: this.origin } : {}),
      apikey: this.anonKey,
      authorization: `Bearer ${accessToken ?? this.anonKey}`,
    };

    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, order, returns, origin: this.origin }),
      });

      if (!response.ok) {
        console.error(`PartyHire API ${action} failed`, response.statusText);
        return null;
      }

      const json = (await response.json()) as T;
      if (!json.ok) {
        console.error(`PartyHire API ${action} returned error`, json.error);
        return null;
      }

      return json;
    } catch (error) {
      console.error(`PartyHire API ${action} exception`, error);
      return null;
    }
  }
}
