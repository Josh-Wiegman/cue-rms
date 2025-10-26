import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { MaintenanceRecord, Vehicle, VehicleStatus } from '../models/vehicle.model';

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
    this.updateVehicles([...existing, ...vehicles]);
    return { added: vehicles.length, skipped, errors };
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
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length < 2) {
      return { vehicles: [], skipped: 0, errors: ['No data rows found.'] };
    }

    const headers = this.normaliseHeaderLine(lines.shift()!);
    const vehicles: Vehicle[] = [];
    const errors: string[] = [];
    let skipped = 0;

    for (const [index, line] of lines.entries()) {
      const values = this.splitCsvLine(line);
      if (values.length !== headers.length) {
        errors.push(
          `Row ${index + 2} skipped: expected ${headers.length} columns but received ${values.length}.`,
        );
        skipped += 1;
        continue;
      }

      const row = Object.fromEntries(
        headers.map((header, headerIndex) => [header, values[headerIndex]]),
      );

      const name = row['vehicle']?.trim();
      const licensePlate = row['license_plate']?.trim() || row['plate']?.trim();
      if (!name || !licensePlate) {
        errors.push(`Row ${index + 2} skipped: vehicle and license plate are required.`);
        skipped += 1;
        continue;
      }

      const status = this.parseStatus(row['status']);

      vehicles.push({
        id: this.createId(),
        location: row['location']?.trim() ?? 'Unassigned',
        name,
        licensePlate: licensePlate.toUpperCase(),
        status,
        details: {
          purchaseDate: row['purchase_date']?.trim() ?? '',
          vin: row['vin']?.trim() ?? '',
          engine: row['engine']?.trim() ?? '',
          chassis: row['chassis']?.trim() ?? '',
          odometer: row['odometer']?.trim() ?? '',
          fuelType: row['fuel_type']?.trim() ?? '',
          transmission: row['transmission']?.trim() ?? '',
          grossVehicleMass: row['gross_vehicle_mass']?.trim() ?? row['gvm']?.trim() ?? '',
          notes: row['notes']?.trim() ?? '',
        },
        maintenance: [],
      });
    }

    return { vehicles, skipped, errors };
  }

  private normaliseHeaderLine(line: string): string[] {
    return this.splitCsvLine(line).map((header) =>
      header
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
