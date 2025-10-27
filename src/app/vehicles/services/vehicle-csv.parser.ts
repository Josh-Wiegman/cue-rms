/* eslint-disable @typescript-eslint/no-unused-vars */
// src/app/vehicles/data/vehicle-csv.parser.ts
import {
  MaintenanceRecord,
  Vehicle,
  VehicleDetails,
  VehicleStatus,
} from '../models/vehicle.model';

/**
 * Public entry point: parses your "blob in A1 + maintenance table" CSVs.
 * - Robust CSV (handles quoted newlines and "" escapes)
 * - Extracts vehicle meta from the first cell blob
 * - Finds maintenance header dynamically (Date, Entered By, What, ...)
 * - Normalizes dates like "13th March 2025" => "2025-03-13"
 * - Infers plate from filename if not in the blob
 */
export function parseVehicleCsv(
  text: string,
  fileName?: string,
  opts?: {
    defaultLocation?: string;
    defaultPurchaseDateToToday?: boolean;
  },
): { vehicles: Vehicle[]; skipped: number; errors: string[] } {
  const errors: string[] = [];
  const skipped = 0;

  const defaultLocation = opts?.defaultLocation ?? 'Dunedin';
  const fillPurchaseDate = opts?.defaultPurchaseDateToToday ?? true;

  const rows = parseCsvMatrix(text);
  if (!rows.length) {
    return { vehicles: [], skipped, errors: ['No data rows found.'] };
  }

  // A1 blob (multiline meta) is first cell of first row
  const firstCell = (rows[0]?.[0] ?? '').toString().trim();

  // Find header row for maintenance table
  const headerIndex = rows.findIndex((r) => {
    const h0 = norm(r?.[0]);
    const h1 = norm(r?.[1]).replace(/:$/, '');
    const h2 = norm(r?.[2]);
    return (
      h0 === 'date' &&
      (h1 === 'entered by' || h1 === 'entered by:') &&
      (h2 === 'what' || h2 === 'type')
    );
  });

  const maintenance: MaintenanceRecord[] = [];
  if (headerIndex >= 0) {
    for (let i = headerIndex + 1; i < rows.length; i++) {
      const r = rows[i] || [];
      const allEmpty = r.every((c) => (c ?? '').toString().trim() === '');
      if (allEmpty) continue;

      // Build record as strings (your app treats these as strings)
      const rec: MaintenanceRecord = {
        id: createId(),
        date: normalizeDate((r[0] ?? '').toString().trim()),
        enteredBy: (r[1] ?? '').toString().trim(),
        work: (r[2] ?? '').toString().trim(),
        odoReading: (r[3] ?? '').toString().trim(),
        performedAt: (r[4] ?? '').toString().trim(),
        outcome: (r[5] ?? '').toString().trim(),
        cost: normalizeCurrencyString((r[6] ?? '').toString()),
        notes: (r[7] ?? '').toString().trim(),
        locked: false,
      };

      if (!hasMaintenanceContent(rec)) continue;
      maintenance.push(rec);
    }
  }

  // Parse vehicle meta blob
  const meta = parseVehicleBlob(firstCell);

  // Infer plate from filename if not found in blob
  const licensePlate =
    (meta.licensePlate ?? '').trim().toUpperCase() ||
    inferPlateFromFileName(fileName) ||
    '';

  const parsedPurchaseDate = '';
  const purchaseDate =
    parsedPurchaseDate ||
    (fillPurchaseDate ? new Date().toISOString().slice(0, 10) : '');

  const details: VehicleDetails = {
    purchaseDate,
    vin: meta.vin ?? '',
    engine: meta.engineNumber ?? '',
    chassis: meta.chassis ?? '',
    odometer: '',
    fuelType: meta.fuelType ?? '',
    transmission: meta.transmission ?? '',
    grossVehicleMass: meta.gvm ?? '',
    notes: meta.details ?? '',
  };

  const vehicle: Vehicle = {
    id: createId(),
    location: defaultLocation,
    name: meta.name || 'Vehicle',
    licensePlate,
    status: 'active',
    details,
    maintenance: maintenance.sort((a, b) => b.date.localeCompare(a.date)),
  };
  return { vehicles: [vehicle], skipped, errors };
}

/* ----------------- helpers ----------------- */

function parseCsvMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        // Escaped quote
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === ',' && !inQuotes) {
      row.push(field);
      field = '';
      continue;
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // End of row (handle CRLF / LF / CR)
      // If CRLF, skip the LF next
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += ch;
  }

  // Flush last field/row
  row.push(field);
  rows.push(row);

  // Trim each cell; DO NOT drop empty rows (header finder might need them).
  return rows.map((r) => r.map((c) => c.trim()));
}

function parseVehicleBlob(blob: string): {
  name: string;
  details: string;
  vin?: string;
  engineNumber?: string;
  chassis?: string;
  ccRating?: string;
  fuelType?: string;
  transmission?: string;
  gvm?: string;
  axles?: string;
  licensePlate?: string;
} {
  const lines = blob
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const name = lines[0] || 'Vehicle';
  const kv: Record<string, string> = {};

  for (const line of lines.slice(1)) {
    const m = line.match(/^([^:]+):\s*(.+)$/);
    if (m) kv[normalizeKey(m[1])] = m[2].trim();
  }

  const out = {
    name,
    details: blob.trim(),
    vin: kv['vin'],
    engineNumber: kv['engine#'] || kv['engine no'] || kv['engine number'],
    chassis: kv['chassis'],
    ccRating: kv['cc rating'],
    fuelType: kv['fuel type'],
    transmission: kv['transmission'],
    gvm: kv['gross vehicle mass'] || kv['gvm'],
    axles: kv['axles'],
    licensePlate: kv['plate'] || kv['license plate'] || kv['registration'],
  };
  return out;
}

function normalizeKey(k: string): string {
  return k
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\.*$/, '')
    .trim()
    .replace(/number\b/g, 'no')
    .replace(/#/g, '#');
}

function normalizeDate(s: string): string {
  if (!s) return '';
  // Remove ordinals: 1st, 2nd, 3rd, 13th...
  const clean = s.replace(/\b(\d{1,2})(st|nd|rd|th)\b/i, '$1').trim();

  // "13 March 2025"
  const m = clean.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const [_, d, mon, y] = m;
    const month = monthIndex(mon);
    if (month >= 0) {
      const dt = new Date(Number(y), month, Number(d));
      if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }
  }

  // Try native
  const n = new Date(clean);
  if (!isNaN(n.getTime())) return n.toISOString().slice(0, 10);

  return ''; // keep empty if unknown
}

function monthIndex(s: string): number {
  const m = s.toLowerCase().slice(0, 3);
  const arr = [
    'jan',
    'feb',
    'mar',
    'apr',
    'may',
    'jun',
    'jul',
    'aug',
    'sep',
    'oct',
    'nov',
    'dec',
  ];
  return arr.indexOf(m);
}

function normalizeCurrencyString(v: string): string {
  const t = v.trim();
  if (!t) return '';
  // keep original if already looks numeric-ish
  const stripped = t.replace(/[^\d.-]/g, '');
  return stripped || t;
}

function hasMaintenanceContent(r: MaintenanceRecord): boolean {
  return [
    r.date,
    r.enteredBy,
    r.work,
    r.odoReading,
    r.performedAt,
    r.outcome,
    r.cost,
    r.notes,
  ].some((x) => (x ?? '').toString().trim().length > 0);
}

function inferPlateFromFileName(fn?: string): string | undefined {
  if (!fn) return undefined;
  const base = fn.replace(/\.[^.]+$/, '');
  const tokens = base.split(/[^A-Za-z0-9]+/).filter(Boolean);
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i].toUpperCase();
    if (/^[A-Z0-9]{3,6}$/.test(t)) return t;
  }
  return undefined;
}

function norm(v: unknown): string {
  return (v ?? '').toString().trim().toLowerCase();
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
}
