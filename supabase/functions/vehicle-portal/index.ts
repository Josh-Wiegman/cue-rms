import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import postgres from "https://deno.land/x/postgresjs@v3.4.3/mod.js";

type SqlClient = ReturnType<typeof postgres>;

type VehicleRow = {
  id: string;
  created_at: string;
  updated_at: string;
  location: string;
  name: string;
  license_plate: string | null;
  status: string | null;
  purchase_date: string | null;
  vin: string | null;
  engine: string | null;
  chassis: string | null;
  odometer: string | null;
  fuel_type: string | null;
  transmission: string | null;
  gross_vehicle_mass: string | null;
  notes: string | null;
  maintenance: MaintenanceRow[];
};

type RawVehicleRow = Omit<VehicleRow, "maintenance">;

type MaintenanceRow = {
  id: string;
  vehicle_id: string;
  created_at: string;
  updated_at: string;
  date: string | null;
  entered_by: string | null;
  work: string | null;
  odo_reading: string | null;
  performed_at: string | null;
  outcome: string | null;
  cost: string | null;
  notes: string | null;
  locked: boolean | null;
};

type VehicleColumns = {
  id: string | null;
  location: string;
  name: string;
  license_plate: string | null;
  status: string;
  purchase_date: string | null;
  vin: string | null;
  engine: string | null;
  chassis: string | null;
  odometer: string | null;
  fuel_type: string | null;
  transmission: string | null;
  gross_vehicle_mass: string | null;
  notes: string | null;
};

type VehiclePayload = {
  columns: VehicleColumns;
  maintenance: MaintenanceInput[];
};

type MaintenanceInput = {
  id: string | null;
  vehicle_id?: string | null;
  date?: string | null;
  entered_by?: string | null;
  work?: string | null;
  odo_reading?: string | null;
  performed_at?: string | null;
  outcome?: string | null;
  cost?: string | null;
  notes?: string | null;
  locked?: boolean | null;
};

type VehicleQueryOptions = {
  limit: number;
  offset: number;
  q: string | null;
};

type OrgContext = {
  orgId: string;
  schema: string;
};

type VehicleRequestArgs = {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
  sql: SqlClient;
  orgId: string;
  schema: string;
};

type MaintenanceRequestArgs = VehicleRequestArgs;

const DATABASE_URL = Deno.env.get("DATABASE_URL");
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET");
const BASE_TENANT_DOMAIN = Deno.env.get("BASE_TENANT_DOMAIN") ?? "";

const DEFAULT_SCHEMA = "public";
const DEFAULT_ORG_ID = "public";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set for the vehicle portal edge function.");
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
    "access-control-allow-headers": "content-type, x-admin-secret, x-org-slug, x-auth-level",
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...corsHeaders(),
    },
  });
}

function orgSchemaFromId(orgId: string): string {
  const prefix = orgId.replace(/-/g, "").slice(0, 8);
  return `org_${prefix}`;
}

function parseHeaderUrl(value: string | null): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

function subdomainFromHost(hostname: string, baseDomain: string): string | null {
  const host = hostname.toLowerCase();
  const base = baseDomain.toLowerCase();
  if (!host.endsWith(base)) return null;
  let remainder = host.slice(0, host.length - base.length);
  if (remainder.endsWith(".")) {
    remainder = remainder.slice(0, -1);
  }
  if (!remainder) {
    return null;
  }
  const [slug] = remainder.split(".").filter(Boolean);
  return slug ?? null;
}

function parseAuthLevel(value: string | null): 1 | 2 | null {
  if (!value) return null;
  const numeric = Number(value);
  if (numeric === 1 || numeric === 2) {
    return numeric;
  }
  return null;
}

async function resolveOrgIdFromReq(
  client: SqlClient,
  req: Request,
  body: Record<string, unknown> | null,
): Promise<OrgContext> {
  const fallback: OrgContext = { orgId: DEFAULT_ORG_ID, schema: DEFAULT_SCHEMA };

  const bodyOrgId = typeof body?.org_id === "string" ? (body.org_id as string) : null;
  if (bodyOrgId) {
    return { orgId: bodyOrgId, schema: orgSchemaFromId(bodyOrgId) };
  }

  const bodySlug = typeof body?.org_slug === "string" ? (body.org_slug as string) : null;
  if (bodySlug) {
    const orgId = await lookupOrgIdBySlug(client, bodySlug);
    if (!orgId) {
      throw new Error("org not found (slug)");
    }
    return { orgId, schema: orgSchemaFromId(orgId) };
  }

  const headerSlug = req.headers.get("x-org-slug");
  if (headerSlug) {
    const orgId = await lookupOrgIdBySlug(client, headerSlug);
    if (!orgId) {
      throw new Error("org not found (header slug)");
    }
    return { orgId, schema: orgSchemaFromId(orgId) };
  }

  if (!BASE_TENANT_DOMAIN) {
    return fallback;
  }

  const origin =
    parseHeaderUrl(req.headers.get("origin")) ?? parseHeaderUrl(req.headers.get("referer"));
  if (!origin) {
    throw new Error("cannot infer org: provide org_id/org_slug or send an Origin/Referer");
  }
  const slug = subdomainFromHost(origin.hostname, BASE_TENANT_DOMAIN);
  if (!slug) {
    throw new Error("origin host not under tenant base domain");
  }
  if (!SLUG_RE.test(slug)) {
    throw new Error("invalid subdomain slug");
  }
  const orgId = await lookupOrgIdBySlug(client, slug);
  if (!orgId) {
    throw new Error("org not found (from subdomain)");
  }
  return { orgId, schema: orgSchemaFromId(orgId) };
}

async function lookupOrgIdBySlug(client: SqlClient, slug: string): Promise<string | null> {
  try {
    const rows = await client`
      select id
      from public.organisations
      where slug = ${slug}
      limit 1
    `;
    if (rows.length === 0) {
      return null;
    }
    return rows[0].id as string;
  } catch (error) {
    console.warn("Organisation lookup failed", error);
    return null;
  }
}

function includesMaintenance(includeParam: string | null): boolean {
  if (!includeParam) return false;
  return includeParam
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .includes("maintenance");
}

function toNullableText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value);
}

function toStatus(value: unknown): string {
  const text = toNullableText(value);
  switch (text?.toLowerCase()) {
    case "sold":
      return "sold";
    case "archived":
      return "archived";
    default:
      return "active";
  }
}

function toBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalised = value.trim().toLowerCase();
    if (normalised === "true") return true;
    if (normalised === "false") return false;
  }
  return null;
}

function hasMaintenanceContent(record: MaintenanceInput): boolean {
  return Boolean(
    record.date ??
      record.entered_by ??
      record.work ??
      record.odo_reading ??
      record.performed_at ??
      record.outcome ??
      record.cost ??
      record.notes,
  );
}

function parseVehiclePayload(body: Record<string, unknown>): VehiclePayload {
  const location = toNullableText(body["location"]);
  const name = toNullableText(body["name"]);
  if (!location) {
    throw new Error("location is required");
  }
  if (!name) {
    throw new Error("name is required");
  }

  const licensePlate =
    toNullableText(body["license_plate"]) ?? toNullableText(body["licensePlate"]);

  const columns: VehicleColumns = {
    id: typeof body["id"] === "string" ? (body["id"] as string) : null,
    location,
    name,
    license_plate: licensePlate,
    status: toStatus(body["status"]),
    purchase_date:
      toNullableText(body["purchase_date"]) ?? toNullableText(body["purchaseDate"]),
    vin: toNullableText(body["vin"]),
    engine: toNullableText(body["engine"]),
    chassis: toNullableText(body["chassis"]),
    odometer: toNullableText(body["odometer"]),
    fuel_type: toNullableText(body["fuel_type"]) ?? toNullableText(body["fuelType"]),
    transmission: toNullableText(body["transmission"]),
    gross_vehicle_mass:
      toNullableText(body["gross_vehicle_mass"]) ??
      toNullableText(body["grossVehicleMass"]),
    notes: toNullableText(body["notes"]),
  };

  const maintenanceRaw = Array.isArray(body["maintenance"]) ? (body["maintenance"] as unknown[]) : [];
  const maintenance = maintenanceRaw
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => parseMaintenanceRecord(item, {
      fallbackVehicleId: columns.id,
      requireVehicleId: false,
    }))
    .filter((record) => hasMaintenanceContent(record));

  return { columns, maintenance };
}

function parseMaintenanceRecord(
  input: Record<string, unknown>,
  options: { fallbackVehicleId?: string | null; requireVehicleId: boolean },
): MaintenanceInput {
  const result: MaintenanceInput = {
    id: typeof input["id"] === "string" ? (input["id"] as string) : null,
  };

  const hasVehicleId = Object.prototype.hasOwnProperty.call(input, "vehicle_id");
  const fallbackVehicleId = options.fallbackVehicleId ?? null;
  const vehicleId = hasVehicleId
    ? (typeof input["vehicle_id"] === "string" ? (input["vehicle_id"] as string) : null)
    : fallbackVehicleId;
  if (options.requireVehicleId && !vehicleId) {
    throw new Error("vehicle_id is required");
  }
  if (vehicleId) {
    result.vehicle_id = vehicleId;
  } else if (hasVehicleId) {
    result.vehicle_id = null;
  }

  if (Object.prototype.hasOwnProperty.call(input, "date")) {
    result.date = toNullableText(input["date"]);
  }
  if (Object.prototype.hasOwnProperty.call(input, "entered_by")) {
    result.entered_by = toNullableText(input["entered_by"]);
  }
  if (Object.prototype.hasOwnProperty.call(input, "work")) {
    result.work = toNullableText(input["work"]);
  }
  if (Object.prototype.hasOwnProperty.call(input, "odo_reading")) {
    result.odo_reading = toNullableText(input["odo_reading"]);
  }
  if (Object.prototype.hasOwnProperty.call(input, "performed_at")) {
    result.performed_at = toNullableText(input["performed_at"]);
  }
  if (Object.prototype.hasOwnProperty.call(input, "outcome")) {
    result.outcome = toNullableText(input["outcome"]);
  }
  if (Object.prototype.hasOwnProperty.call(input, "cost")) {
    result.cost = toNullableText(input["cost"]);
  }
  if (Object.prototype.hasOwnProperty.call(input, "notes")) {
    result.notes = toNullableText(input["notes"]);
  }
  if (Object.prototype.hasOwnProperty.call(input, "locked")) {
    result.locked = toBoolean(input["locked"]);
  }

  return result;
}

function mergeMaintenanceColumns(existing: MaintenanceRow, update: MaintenanceInput) {
  return {
    vehicle_id: update.vehicle_id ?? existing.vehicle_id,
    date: update.date !== undefined ? update.date : existing.date,
    entered_by: update.entered_by !== undefined ? update.entered_by : existing.entered_by,
    work: update.work !== undefined ? update.work : existing.work,
    odo_reading: update.odo_reading !== undefined ? update.odo_reading : existing.odo_reading,
    performed_at: update.performed_at !== undefined ? update.performed_at : existing.performed_at,
    outcome: update.outcome !== undefined ? update.outcome : existing.outcome,
    cost: update.cost !== undefined ? update.cost : existing.cost,
    notes: update.notes !== undefined ? update.notes : existing.notes,
    locked: update.locked !== undefined ? Boolean(update.locked) : Boolean(existing.locked),
  };
}

async function fetchVehicles(
  client: SqlClient,
  schema: string,
  options: VehicleQueryOptions,
  includeMaintenance: boolean,
): Promise<VehicleRow[]> {
  const { limit, offset, q } = options;
  let rows: RawVehicleRow[];
  if (q) {
    const like = `%${q}%`;
    rows = await client<RawVehicleRow[]>`
      select *
      from ${client(schema)}.vehicles
      where license_plate ilike ${like}
         or name ilike ${like}
         or vin ilike ${like}
      order by updated_at desc nulls last, created_at desc nulls last
      limit ${limit} offset ${offset}
    `;
  } else {
    rows = await client<RawVehicleRow[]>`
      select *
      from ${client(schema)}.vehicles
      order by updated_at desc nulls last, created_at desc nulls last
      limit ${limit} offset ${offset}
    `;
  }

  if (rows.length === 0) {
    return rows.map((row) => ({ ...row, maintenance: [] }));
  }

  if (!includeMaintenance) {
    return rows.map((row) => ({ ...row, maintenance: [] }));
  }

  const maintenanceMap = await fetchMaintenanceForVehicles(
    client,
    schema,
    rows.map((row) => row.id),
  );

  return rows.map((row) => ({
    ...row,
    maintenance: maintenanceMap.get(row.id) ?? [],
  }));
}

async function fetchVehicleById(
  client: SqlClient,
  schema: string,
  id: string,
  includeMaintenance: boolean,
): Promise<VehicleRow | null> {
  const rows = await client<RawVehicleRow[]>`
    select *
    from ${client(schema)}.vehicles
    where id = ${id}::uuid
    limit 1
  `;
  if (rows.length === 0) {
    return null;
  }
  const base = rows[0];
  if (!includeMaintenance) {
    return { ...base, maintenance: [] };
  }
  const maintenanceMap = await fetchMaintenanceForVehicles(client, schema, [base.id]);
  return { ...base, maintenance: maintenanceMap.get(base.id) ?? [] };
}

async function fetchMaintenanceForVehicles(
  client: SqlClient,
  schema: string,
  vehicleIds: string[],
): Promise<Map<string, MaintenanceRow[]>> {
  const map = new Map<string, MaintenanceRow[]>();
  if (vehicleIds.length === 0) {
    return map;
  }

  const records = await client<MaintenanceRow[]>`
    select *
    from ${client(schema)}.vehicle_maintenance_records
    where vehicle_id = any(${client.array(vehicleIds, "uuid")})
    order by date desc nulls last, created_at desc nulls last
  `;

  for (const record of records) {
    const existing = map.get(record.vehicle_id) ?? [];
    existing.push(record);
    map.set(record.vehicle_id, existing);
  }
  return map;
}

async function insertMaintenanceRecords(
  client: SqlClient,
  schema: string,
  vehicleId: string,
  records: MaintenanceInput[],
): Promise<void> {
  for (const record of records) {
    if (!hasMaintenanceContent(record)) {
      continue;
    }
    const targetVehicleId = record.vehicle_id ?? vehicleId;
    if (!targetVehicleId) {
      continue;
    }
    const lockedValue = record.locked ?? false;
    await client`
      insert into ${client(schema)}.vehicle_maintenance_records
        (id, vehicle_id, date, entered_by, work, odo_reading, performed_at, outcome, cost, notes, locked)
      values
        (coalesce(${record.id ?? null}::uuid, gen_random_uuid()),
         ${targetVehicleId}::uuid,
         ${record.date ?? null}::date,
         ${record.entered_by ?? null},
         ${record.work ?? null},
         ${record.odo_reading ?? null},
         ${record.performed_at ?? null},
         ${record.outcome ?? null},
         ${record.cost ?? null},
         ${record.notes ?? null},
         ${lockedValue})
      on conflict (id) do update set
         vehicle_id = excluded.vehicle_id,
         date = excluded.date,
         entered_by = excluded.entered_by,
         work = excluded.work,
         odo_reading = excluded.odo_reading,
         performed_at = excluded.performed_at,
         outcome = excluded.outcome,
         cost = excluded.cost,
         notes = excluded.notes,
         locked = excluded.locked,
         updated_at = now()
    `;
  }
}

async function handleVehicleRequest(args: VehicleRequestArgs): Promise<Response> {
  switch (args.method) {
    case "GET":
      return handleVehicleGet(args);
    case "POST":
      return handleVehicleCreate(args);
    case "PUT":
      return handleVehicleUpsert(args);
    case "DELETE":
      return handleVehicleDelete(args);
    default:
      return json({ error: "Method Not Allowed" }, 405);
  }
}

async function handleVehicleGet({ url, sql, schema, orgId }: VehicleRequestArgs): Promise<Response> {
  const id = url.searchParams.get("id");
  const includeMaintenance = includesMaintenance(url.searchParams.get("include"));
  const limit = Math.max(0, Math.min(500, Number(url.searchParams.get("limit") ?? "100")));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0"));
  const qRaw = url.searchParams.get("q");
  const q = qRaw && qRaw.trim().length > 0 ? qRaw.trim() : null;

  if (id) {
    const vehicle = await fetchVehicleById(sql, schema, id, includeMaintenance);
    if (!vehicle) {
      return json({ ok: false, error: "not_found", org_id: orgId, schema }, 404);
    }
    return json({ ok: true, org_id: orgId, schema, vehicle });
  }

  const items = await fetchVehicles(sql, schema, { limit, offset, q }, includeMaintenance);
  return json({ ok: true, org_id: orgId, schema, items, limit, offset, q: q ?? undefined });
}

async function handleVehicleCreate({ body, sql, schema, orgId }: VehicleRequestArgs): Promise<Response> {
  if (!body) {
    return json({ error: "invalid body" }, 400);
  }

  let payload: VehiclePayload;
  try {
    payload = parseVehiclePayload(body);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }

  const inserted = await sql<RawVehicleRow[]>`
    insert into ${sql(schema)}.vehicles
      (id, created_at, updated_at, location, name, license_plate, status, purchase_date,
       vin, engine, chassis, odometer, fuel_type, transmission, gross_vehicle_mass, notes)
    values
      (coalesce(${payload.columns.id ?? null}::uuid, gen_random_uuid()),
       now(), now(),
       ${payload.columns.location},
       ${payload.columns.name},
       ${payload.columns.license_plate},
       ${payload.columns.status},
       ${payload.columns.purchase_date ?? null}::date,
       ${payload.columns.vin},
       ${payload.columns.engine},
       ${payload.columns.chassis},
       ${payload.columns.odometer},
       ${payload.columns.fuel_type},
       ${payload.columns.transmission},
       ${payload.columns.gross_vehicle_mass},
       ${payload.columns.notes})
    returning *
  `;

  const created = inserted[0];
  if (!created) {
    throw new Error("vehicle insert failed");
  }

  if (payload.maintenance.length > 0) {
    await insertMaintenanceRecords(sql, schema, created.id, payload.maintenance);
  }

  const vehicle = await fetchVehicleById(sql, schema, created.id, true);
  return json({
    ok: true,
    action: "create",
    org_id: orgId,
    schema,
    vehicle: vehicle ?? { ...created, maintenance: [] },
  }, 201);
}

async function handleVehicleUpsert({ body, sql, schema, orgId }: VehicleRequestArgs): Promise<Response> {
  if (!body) {
    return json({ error: "invalid body" }, 400);
  }

  let payload: VehiclePayload;
  try {
    payload = parseVehiclePayload(body);
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }

  const upserted = await sql<RawVehicleRow[]>`
    insert into ${sql(schema)}.vehicles
      (id, created_at, updated_at, location, name, license_plate, status, purchase_date,
       vin, engine, chassis, odometer, fuel_type, transmission, gross_vehicle_mass, notes)
    values
      (coalesce(${payload.columns.id ?? null}::uuid, gen_random_uuid()),
       now(), now(),
       ${payload.columns.location},
       ${payload.columns.name},
       ${payload.columns.license_plate},
       ${payload.columns.status},
       ${payload.columns.purchase_date ?? null}::date,
       ${payload.columns.vin},
       ${payload.columns.engine},
       ${payload.columns.chassis},
       ${payload.columns.odometer},
       ${payload.columns.fuel_type},
       ${payload.columns.transmission},
       ${payload.columns.gross_vehicle_mass},
       ${payload.columns.notes})
    on conflict (id) do update set
       updated_at = now(),
       location = excluded.location,
       name = excluded.name,
       license_plate = excluded.license_plate,
       status = excluded.status,
       purchase_date = excluded.purchase_date,
       vin = excluded.vin,
       engine = excluded.engine,
       chassis = excluded.chassis,
       odometer = excluded.odometer,
       fuel_type = excluded.fuel_type,
       transmission = excluded.transmission,
       gross_vehicle_mass = excluded.gross_vehicle_mass,
       notes = excluded.notes
    returning *
  `;

  const updated = upserted[0];
  if (!updated) {
    throw new Error("vehicle upsert failed");
  }

  if (payload.maintenance.length > 0) {
    await insertMaintenanceRecords(sql, schema, updated.id, payload.maintenance);
  }

  const vehicle = await fetchVehicleById(sql, schema, updated.id, true);
  return json({
    ok: true,
    action: "upsert",
    org_id: orgId,
    schema,
    vehicle: vehicle ?? { ...updated, maintenance: [] },
  });
}

async function handleVehicleDelete({ body, sql, schema, orgId }: VehicleRequestArgs): Promise<Response> {
  const id = typeof body?.id === "string" ? (body?.id as string) : null;
  if (!id) {
    return json({ error: "id required" }, 400);
  }

  const rows = await sql`
    delete from ${sql(schema)}.vehicles
    where id = ${id}::uuid
    returning id
  `;

  if (rows.length === 0) {
    return json({ ok: false, error: "not_found", org_id: orgId, schema }, 404);
  }

  return json({ ok: true, action: "delete", org_id: orgId, schema, id: rows[0].id });
}

async function handleMaintenanceRequest(args: MaintenanceRequestArgs): Promise<Response> {
  switch (args.method) {
    case "GET":
      return handleMaintenanceGet(args);
    case "POST":
      return handleMaintenanceCreate(args);
    case "PUT":
      return handleMaintenanceUpdate(args);
    case "DELETE":
      return handleMaintenanceDelete(args);
    default:
      return json({ error: "Method Not Allowed" }, 405);
  }
}

async function handleMaintenanceGet({ url, sql, schema, orgId }: MaintenanceRequestArgs): Promise<Response> {
  const vehicleId = url.searchParams.get("vehicle_id");
  if (!vehicleId) {
    return json({ error: "vehicle_id required" }, 400);
  }

  const rows = await sql<MaintenanceRow[]>`
    select *
    from ${sql(schema)}.vehicle_maintenance_records
    where vehicle_id = ${vehicleId}::uuid
    order by date desc nulls last, created_at desc nulls last
  `;

  return json({ ok: true, org_id: orgId, schema, items: rows });
}

async function handleMaintenanceCreate({ body, sql, schema, orgId }: MaintenanceRequestArgs): Promise<Response> {
  if (!body) {
    return json({ error: "invalid body" }, 400);
  }

  let payload: MaintenanceInput;
  try {
    payload = parseMaintenanceRecord(body, { fallbackVehicleId: null, requireVehicleId: true });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }

  const lockedValue = payload.locked ?? false;
  const inserted = await sql<MaintenanceRow[]>`
    insert into ${sql(schema)}.vehicle_maintenance_records
      (id, vehicle_id, date, entered_by, work, odo_reading, performed_at, outcome, cost, notes, locked)
    values
      (coalesce(${payload.id ?? null}::uuid, gen_random_uuid()),
       ${payload.vehicle_id}::uuid,
       ${payload.date ?? null}::date,
       ${payload.entered_by ?? null},
       ${payload.work ?? null},
       ${payload.odo_reading ?? null},
       ${payload.performed_at ?? null},
       ${payload.outcome ?? null},
       ${payload.cost ?? null},
       ${payload.notes ?? null},
       ${lockedValue})
    returning *
  `;

  return json({ ok: true, action: "create", org_id: orgId, schema, record: inserted[0] });
}

async function handleMaintenanceUpdate({ body, sql, schema, orgId }: MaintenanceRequestArgs): Promise<Response> {
  const id = typeof body?.id === "string" ? (body?.id as string) : null;
  if (!id) {
    return json({ error: "id required" }, 400);
  }

  let payload: MaintenanceInput;
  try {
    payload = parseMaintenanceRecord(body, { fallbackVehicleId: null, requireVehicleId: false });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }

  const existingRows = await sql<MaintenanceRow[]>`
    select *
    from ${sql(schema)}.vehicle_maintenance_records
    where id = ${id}::uuid
    limit 1
  `;

  if (existingRows.length === 0) {
    return json({ ok: false, error: "not_found", org_id: orgId, schema }, 404);
  }

  const merged = mergeMaintenanceColumns(existingRows[0], payload);
  const updated = await sql<MaintenanceRow[]>`
    update ${sql(schema)}.vehicle_maintenance_records
    set
      vehicle_id = ${merged.vehicle_id}::uuid,
      date = ${merged.date ?? null}::date,
      entered_by = ${merged.entered_by ?? null},
      work = ${merged.work ?? null},
      odo_reading = ${merged.odo_reading ?? null},
      performed_at = ${merged.performed_at ?? null},
      outcome = ${merged.outcome ?? null},
      cost = ${merged.cost ?? null},
      notes = ${merged.notes ?? null},
      locked = ${merged.locked},
      updated_at = now()
    where id = ${id}::uuid
    returning *
  `;

  return json({ ok: true, action: "update", org_id: orgId, schema, record: updated[0] });
}

async function handleMaintenanceDelete({ body, sql, schema, orgId }: MaintenanceRequestArgs): Promise<Response> {
  const id = typeof body?.id === "string" ? (body?.id as string) : null;
  if (!id) {
    return json({ error: "id required" }, 400);
  }

  const rows = await sql`
    delete from ${sql(schema)}.vehicle_maintenance_records
    where id = ${id}::uuid
    returning id
  `;

  if (rows.length === 0) {
    return json({ ok: false, error: "not_found", org_id: orgId, schema }, 404);
  }

  return json({ ok: true, action: "delete", org_id: orgId, schema, id: rows[0].id });
}

async function parseJsonBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("invalid JSON body");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  if (!ADMIN_SECRET || req.headers.get("x-admin-secret") !== ADMIN_SECRET) {
    return json({ error: "unauthorized" }, 401);
  }

  let sqlClient: SqlClient | null = null;

  try {
    sqlClient = postgres(DATABASE_URL, { prepare: true });

    const method = req.method.toUpperCase();
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "");
    const isMaintenanceRequest = path.endsWith("/maintenance");

    let body: Record<string, unknown> | null = null;
    if (method !== "GET") {
      try {
        body = await parseJsonBody(req);
      } catch (error) {
        return json({ error: (error as Error).message }, 400);
      }
    }

    const authLevel = parseAuthLevel(req.headers.get("x-auth-level"));

    return await sqlClient.begin(async (transaction) => {
      const level = authLevel ?? 2;
      await transaction`select set_config('app.auth_level', ${String(level)}, true)`;
      const context = await resolveOrgIdFromReq(transaction, req, body);
      const args: VehicleRequestArgs = {
        method,
        url,
        body,
        sql: transaction,
        orgId: context.orgId,
        schema: context.schema,
      };

      if (isMaintenanceRequest) {
        return handleMaintenanceRequest(args);
      }

      return handleVehicleRequest(args);
    });
  } catch (error) {
    console.error(error);
    return json({ error: String(error?.message ?? error) }, 500);
  } finally {
    if (sqlClient) {
      await sqlClient.end();
    }
  }
});
