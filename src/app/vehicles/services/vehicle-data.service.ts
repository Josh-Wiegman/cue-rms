import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  MaintenanceRecord,
  Vehicle,
  VehicleDetails,
  VehicleStatus,
} from '../models/vehicle.model';

export interface VehicleInput {
  location: string;
  name: string;
  licensePlate: string;
  status?: VehicleStatus;
  details?: Partial<Vehicle['details']>;
  maintenance?: MaintenanceRecord[];
}

export interface CsvImportResult {
  added: number;
  skipped: number;
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class VehicleDataService {
  private readonly storageKey = 'vehicle-portal-data';
  private readonly vehiclesSubject = new BehaviorSubject<Vehicle[]>(
    this.loadFromStorage(),
  );

  readonly vehicles$ = this.vehiclesSubject.asObservable();

  addVehicle(payload: VehicleInput): Vehicle {
    const vehicles = this.cloneVehicles();
    const vehicle: Vehicle = {
      id: this.createId(),
      location: payload.location.trim(),
      name: payload.name.trim(),
      licensePlate: payload.licensePlate.trim().toUpperCase(),
      status: payload.status ?? 'active',
      details: {
        purchaseDate: payload.details?.purchaseDate ?? '',
        vin: payload.details?.vin ?? '',
        engine: payload.details?.engine ?? '',
        chassis: payload.details?.chassis ?? '',
        odometer: payload.details?.odometer ?? '',
        fuelType: payload.details?.fuelType ?? '',
        transmission: payload.details?.transmission ?? '',
        grossVehicleMass: payload.details?.grossVehicleMass ?? '',
        notes: payload.details?.notes ?? '',
      },
      maintenance: payload.maintenance ?? [],
    };

    vehicles.push(vehicle);
    this.updateVehicles(vehicles);
    return vehicle;
  }

  updateVehicle(id: string, updater: (vehicle: Vehicle) => Vehicle): void {
    const vehicles = this.cloneVehicles();
    const index = vehicles.findIndex((vehicle) => vehicle.id === id);
    if (index === -1) {
      return;
    }

    vehicles[index] = updater(vehicles[index]);
    this.updateVehicles(vehicles);
  }

  removeVehicle(id: string): void {
    const vehicles = this.cloneVehicles().filter((vehicle) => vehicle.id !== id);
    this.updateVehicles(vehicles);
  }

  markVehicleStatus(id: string, status: VehicleStatus): void {
    this.updateVehicle(id, (vehicle) => ({
      ...vehicle,
      status,
    }));
  }

  addMaintenanceRecord(id: string, record: Omit<MaintenanceRecord, 'id'>): void {
    const newRecord: MaintenanceRecord = {
      ...record,
      id: this.createId(),
    };

    this.updateVehicle(id, (vehicle) => ({
      ...vehicle,
      maintenance: [newRecord, ...vehicle.maintenance],
    }));
  }

  updateMaintenanceRecord(
    vehicleId: string,
    recordId: string,
    updater: (record: MaintenanceRecord) => MaintenanceRecord,
  ): void {
    this.updateVehicle(vehicleId, (vehicle) => ({
      ...vehicle,
      maintenance: vehicle.maintenance.map((record) =>
        record.id === recordId ? updater(record) : record,
      ),
    }));
  }

  removeMaintenanceRecord(vehicleId: string, recordId: string): void {
    this.updateVehicle(vehicleId, (vehicle) => ({
      ...vehicle,
      maintenance: vehicle.maintenance.filter((record) => record.id !== recordId),
    }));
  }

  replaceAll(vehicles: Vehicle[]): void {
    this.updateVehicles(this.clone(vehicles));
  }

  async importCsv(file: File): Promise<CsvImportResult> {
    const text = await file.text();
    const { vehicles, skipped, errors } = this.parseCsv(text);
    if (vehicles.length === 0) {
      return { added: 0, skipped, errors };
    }

    const existing = this.cloneVehicles();
    const existingByPlate = new Map(
      existing.map((vehicle) => [vehicle.licensePlate.toUpperCase(), vehicle]),
    );

    let added = 0;
    for (const vehicle of vehicles) {
      const key = vehicle.licensePlate.toUpperCase();
      const current = existingByPlate.get(key);
      if (current) {
        this.mergeVehicle(current, vehicle);
        continue;
      }

      existing.push(vehicle);
      existingByPlate.set(key, vehicle);
      added += 1;
    }

    this.updateVehicles(existing);
    return { added, skipped, errors };
  }

  toggleMaintenanceLock(vehicleId: string, recordId: string): void {
    this.updateMaintenanceRecord(vehicleId, recordId, (record) => ({
      ...record,
      locked: !record.locked,
    }));
  }

  private cloneVehicles(): Vehicle[] {
    return this.clone(this.vehiclesSubject.value);
  }

  private updateVehicles(vehicles: Vehicle[]): void {
    this.vehiclesSubject.next(vehicles);
    this.persistToStorage(vehicles);
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private loadFromStorage(): Vehicle[] {
    if (typeof window === 'undefined' || !window.localStorage) {
      return this.sampleVehicles();
    }

    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) {
      return this.sampleVehicles();
    }

    try {
      const parsed = JSON.parse(raw) as Vehicle[];
      if (!Array.isArray(parsed)) {
        return this.sampleVehicles();
      }
      return parsed;
    } catch (error) {
      console.warn('Failed to parse stored vehicles', error);
      return this.sampleVehicles();
    }
  }

  private persistToStorage(vehicles: Vehicle[]): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(this.storageKey, JSON.stringify(vehicles));
  }

  private parseCsv(text: string): {
    vehicles: Vehicle[];
    skipped: number;
    errors: string[];
  } {
    const rawLines = text.split(/\r?\n/);
    const lines = rawLines.filter((line) => line.trim().length > 0);

    if (lines.length < 2) {
      return { vehicles: [], skipped: 0, errors: ['No data rows found.'] };
    }

    const headers = this.normaliseHeaderLine(lines.shift()!);
    const vehiclesByPlate = new Map<string, Vehicle>();
    const errors: string[] = [];
    let skipped = 0;

    lines.forEach((line, index) => {
      const values = this.splitCsvLine(line);
      if (values.length < headers.length) {
        values.push(...Array(headers.length - values.length).fill(''));
      } else if (values.length > headers.length) {
        errors.push(
          `Row ${index + 2} skipped: expected ${headers.length} columns but received ${values.length}.`,
        );
        skipped += 1;
        return;
      }

      const row: Record<string, string> = {};
      headers.forEach((header, headerIndex) => {
        row[header] = values[headerIndex] ?? '';
      });

      const name = this.getRowValue(row, [
        'vehicle',
        'vehicle_name',
        'name',
        'vehicle_description',
        'vehicle_make_model',
      ]);
      const licensePlateRaw = this.getRowValue(row, [
        'license_plate',
        'plate',
        'registration',
        'rego',
        'license',
        'licence_plate',
        'registration_plate',
        'rego_number',
        'registration_number',
        'license_number',
        'licence_number',
      ]);

      if (!name || !licensePlateRaw) {
        errors.push(`Row ${index + 2} skipped: vehicle and license plate are required.`);
        skipped += 1;
        return;
      }

      const licensePlate = licensePlateRaw.toUpperCase();
      const status = this.parseStatus(
        this.getRowValue(row, ['status', 'vehicle_status', 'current_status']),
      );

      const candidate: Vehicle = {
        id: this.createId(),
        location:
          this.getRowValue(row, [
            'location',
            'branch',
            'site',
            'depot',
            'base',
            'branch_location',
            'region',
          ]) || 'Unassigned',
        name,
        licensePlate,
        status,
        details: {
          purchaseDate: this.getRowValue(row, [
            'purchase_date',
            'purchased',
            'purchase',
            'date_purchased',
          ]),
          vin: this.getRowValue(row, ['vin', 'vehicle_identification_number']),
          engine: this.getRowValue(row, ['engine', 'engine_type']),
          chassis: this.getRowValue(row, ['chassis', 'chassis_number', 'frame_number']),
          odometer: this.getRowValue(row, ['odometer', 'odometer_reading', 'odo', 'mileage']),
          fuelType: this.getRowValue(row, ['fuel_type', 'fuel']),
          transmission: this.getRowValue(row, ['transmission', 'gearbox']),
          grossVehicleMass: this.getRowValue(row, [
            'gross_vehicle_mass',
            'gvm',
            'gvw',
            'gvm_kg',
            'gross_vehicle_weight',
          ]),
          notes: this.getRowValue(row, ['vehicle_notes', 'notes', 'comments', 'vehicle_comments']),
        },
        maintenance: this.extractMaintenanceRecords(row),
      };

      const existing = vehiclesByPlate.get(licensePlate);
      if (existing) {
        this.mergeVehicle(existing, candidate);
      } else {
        vehiclesByPlate.set(licensePlate, candidate);
      }
    });

    const vehicles = Array.from(vehiclesByPlate.values());

    return { vehicles, skipped, errors };
  }

  private normaliseHeaderLine(line: string): string[] {
    return this.splitCsvLine(line).map((header) =>
      header
        .replace(/^\ufeff/, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '_'),
    );
  }

  private splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
          continue;
        }
        inQuotes = !inQuotes;
        continue;
      }

      if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  }

  private getRowValue(row: Record<string, string>, keys: string[]): string {
    for (const key of keys) {
      const value = row[key];
      if (value && value.trim().length > 0) {
        return value.trim();
      }
    }
    return '';
  }

  private mergeVehicle(target: Vehicle, source: Vehicle): void {
    if (source.name && source.name.length > target.name.length) {
      target.name = source.name;
    }

    if (source.location && source.location !== 'Unassigned') {
      const shouldUpdate =
        !target.location ||
        target.location === 'Unassigned' ||
        source.location.length > target.location.length;
      if (shouldUpdate) {
        target.location = source.location;
      }
    }

    if (source.status !== target.status) {
      const priority = (status: VehicleStatus): number => {
        switch (status) {
          case 'archived':
            return 2;
          case 'sold':
            return 1;
          default:
            return 0;
        }
      };
      if (priority(source.status) >= priority(target.status)) {
        target.status = source.status;
      }
    }

    target.details = this.mergeVehicleDetails(target.details, source.details);
    target.maintenance = this.mergeMaintenanceRecords(target.maintenance, source.maintenance);
  }

  private mergeVehicleDetails(
    target: VehicleDetails,
    source: VehicleDetails,
  ): VehicleDetails {
    const merged: VehicleDetails = { ...target };
    (Object.keys(source) as (keyof VehicleDetails)[]).forEach((key) => {
      const targetValue = merged[key]?.trim() ?? '';
      const sourceValue = source[key]?.trim() ?? '';
      if (!targetValue && sourceValue) {
        merged[key] = sourceValue;
      }
    });
    return merged;
  }

  private mergeMaintenanceRecords(
    existing: MaintenanceRecord[],
    incoming: MaintenanceRecord[],
  ): MaintenanceRecord[] {
    if (!incoming.length) {
      return existing;
    }

    const merged = [...existing];
    incoming.forEach((record) => {
      const hasDuplicate = merged.some((existingRecord) =>
        this.maintenanceRecordsEqual(existingRecord, record),
      );
      if (!hasDuplicate) {
        merged.push(record);
      }
    });
    return merged;
  }

  private maintenanceRecordsEqual(
    a: MaintenanceRecord,
    b: MaintenanceRecord,
  ): boolean {
    const normalise = (value: string) => value.trim().toLowerCase();
    return (
      normalise(a.date) === normalise(b.date) &&
      normalise(a.enteredBy) === normalise(b.enteredBy) &&
      normalise(a.work) === normalise(b.work) &&
      normalise(a.odoReading) === normalise(b.odoReading) &&
      normalise(a.performedAt) === normalise(b.performedAt) &&
      normalise(a.outcome) === normalise(b.outcome) &&
      normalise(a.cost) === normalise(b.cost) &&
      normalise(a.notes) === normalise(b.notes)
    );
  }

  private extractMaintenanceRecords(row: Record<string, string>): MaintenanceRecord[] {
    const groups = new Map<string, Partial<MaintenanceRecord> & { locked?: boolean }>();

    Object.entries(row).forEach(([key, value]) => {
      if (!value) {
        return;
      }

      const prefixMatch = key.match(/^(maintenance|service|log)_(.+)$/);
      if (!prefixMatch) {
        return;
      }

      let remainder = prefixMatch[2];
      if (/^(next|upcoming|future)_/.test(remainder) || /_next$/.test(remainder)) {
        return;
      }
      if (remainder.includes('interval') || remainder.includes('due')) {
        return;
      }

      const leadingIndex = remainder.match(/^(\d+)_/);
      const trailingIndex = remainder.match(/_(\d+)$/);
      let index = '0';
      if (leadingIndex) {
        index = leadingIndex[1];
        remainder = remainder.slice(leadingIndex[0].length);
      } else if (trailingIndex) {
        index = trailingIndex[1];
        remainder = remainder.slice(0, -trailingIndex[0].length);
      }

      remainder = remainder.replace(/^(log|entry|record)_/, '');
      const field = this.mapMaintenanceField(remainder);
      if (!field) {
        return;
      }

      const group =
        groups.get(index) ?? ({} as Partial<MaintenanceRecord> & { locked?: boolean });
      if (field === 'locked') {
        (group as { locked?: boolean }).locked = this.parseLockedValue(value);
      } else {
        (group as Partial<MaintenanceRecord>)[field] = value;
      }
      groups.set(index, group);
    });

    const records: MaintenanceRecord[] = [];
    Array.from(groups.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .forEach(([, partial]) => {
        const record = this.toMaintenanceRecord(partial);
        if (record) {
          records.push(record);
        }
      });

    return records;
  }

  private mapMaintenanceField(segment: string): keyof MaintenanceRecord | null {
    const cleaned = segment.replace(/__+/g, '_');
    if (cleaned.includes('update')) {
      return null;
    }

    const matches = (pattern: RegExp) => pattern.test(cleaned);

    if (matches(/(?:^|_)(date|performed|completed|inspection)(?:_|$)/)) {
      return 'date';
    }
    if (matches(/(?:^|_)(entered|recorded|logged|author|mechanic|technician)(?:_|$)/)) {
      return 'enteredBy';
    }
    if (matches(/(?:^|_)(work|description|task|scope|type|service|activity|job)(?:_|$)/)) {
      return 'work';
    }
    if (matches(/(?:^|_)(odo|odometer|km|kms|mileage)(?:_|$)/)) {
      return 'odoReading';
    }
    if (matches(/(?:^|_)(performed_at|location|where|provider|supplier|workshop|service_centre|service_center|garage|centre|center)(?:_|$)/)) {
      return 'performedAt';
    }
    if (matches(/(?:^|_)(outcome|result|status|inspection_result)(?:_|$)/)) {
      return 'outcome';
    }
    if (matches(/(?:^|_)(cost|amount|price|total_cost|expense|spend|value)(?:_|$)/)) {
      return 'cost';
    }
    if (matches(/(?:^|_)(notes|comment|remark|detail|summary|observation)(?:_|$)/)) {
      return 'notes';
    }
    if (matches(/(?:^|_)(locked|lock|is_locked)(?:_|$)/)) {
      return 'locked';
    }
    return null;
  }

  private parseLockedValue(raw: string): boolean {
    const value = raw.trim().toLowerCase();
    return value === 'true' || value === 'yes' || value === 'locked' || value === '1';
  }

  private toMaintenanceRecord(
    source: Partial<MaintenanceRecord> & { locked?: boolean },
  ): MaintenanceRecord | null {
    const record: MaintenanceRecord = {
      id: this.createId(),
      date: source.date?.trim() ?? '',
      enteredBy: source.enteredBy?.trim() ?? '',
      work: source.work?.trim() ?? '',
      odoReading: source.odoReading?.trim() ?? '',
      performedAt: source.performedAt?.trim() ?? '',
      outcome: source.outcome?.trim() ?? '',
      cost: source.cost?.trim() ?? '',
      notes: source.notes?.trim() ?? '',
      locked: source.locked ?? false,
    };

    if (!this.hasMaintenanceContent(record)) {
      return null;
    }

    return record;
  }

  private hasMaintenanceContent(record: MaintenanceRecord): boolean {
    return [
      record.date,
      record.enteredBy,
      record.work,
      record.odoReading,
      record.performedAt,
      record.outcome,
      record.cost,
      record.notes,
    ].some((value) => value.trim().length > 0);
  }

  private parseStatus(raw: string | undefined): VehicleStatus {
    const value = raw?.toLowerCase() ?? '';
    if (value === 'sold') {
      return 'sold';
    }
    if (value === 'archived') {
      return 'archived';
    }
    return 'active';
  }

  private createId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2, 11);
  }

  private sampleVehicles(): Vehicle[] {
    const now = new Date().toISOString().split('T')[0];
    return [
      {
        id: this.createId(),
        location: 'Dunedin',
        name: 'Hino Truck (Class 2)',
        licensePlate: 'APQ960',
        status: 'active',
        details: {
          purchaseDate: now,
          vin: 'JN1WY26U5XM123456',
          engine: 'Hino J08E',
          chassis: 'TRK1234567',
          odometer: '205,418 km',
          fuelType: 'Diesel',
          transmission: 'Automatic',
          grossVehicleMass: '12,000 kg',
          notes: 'Tail lift serviced in 2024.',
        },
        maintenance: [
          {
            id: this.createId(),
            date: '2025-02-20',
            enteredBy: 'Hollie Walsh',
            work: 'COF & maintenance',
            odoReading: '205,000',
            performedAt: 'Vinz',
            outcome: 'Passed',
            cost: '$650.00',
            notes: 'Replaced wiper blades and adjusted brake bias.',
            locked: false,
          },
        ],
      },
      {
        id: this.createId(),
        location: 'Christchurch',
        name: 'Corolla',
        licensePlate: 'FTN850',
        status: 'active',
        details: {
          purchaseDate: '2022-10-12',
          vin: 'JTDBR32E330076543',
          engine: '1.8L Petrol',
          chassis: 'BR32E330076543',
          odometer: '98,214 km',
          fuelType: 'Petrol',
          transmission: 'Automatic',
          grossVehicleMass: '1,600 kg',
          notes: 'Assigned to Christchurch operations team.',
        },
        maintenance: [],
      },
    ];
  }
}
