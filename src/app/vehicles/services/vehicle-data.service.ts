import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { BehaviorSubject } from 'rxjs';
import { SupabaseService } from '../../shared/supabase-service/supabase.service';
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

type VehicleRow = {
  id: string;
  location: string | null;
  name: string | null;
  license_plate: string;
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
  maintenance: MaintenanceRow[] | null;
};

type MaintenanceRow = {
  id: string;
  vehicle_id: string;
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

@Injectable({ providedIn: 'root' })
export class VehicleDataService {
  private readonly vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  private readonly supabaseClient: SupabaseClient;
  private readonly vehicleSelect =
    'id, location, name, license_plate, status, purchase_date, vin, engine, chassis, odometer, fuel_type, transmission, gross_vehicle_mass, notes, maintenance:vehicle_maintenance_records(id, vehicle_id, date, entered_by, work, odo_reading, performed_at, outcome, cost, notes, locked)';

  readonly vehicles$ = this.vehiclesSubject.asObservable();

  constructor(private readonly supabaseService: SupabaseService) {
    this.supabaseClient = this.supabaseService.client;
    void this.refreshVehicles();
  }

  async addVehicle(payload: VehicleInput): Promise<Vehicle | null> {
    const columns = this.buildVehicleColumns({
      location: payload.location.trim(),
      name: payload.name.trim(),
      licensePlate: payload.licensePlate.trim().toUpperCase(),
      status: payload.status ?? 'active',
      details: this.buildVehicleDetails(payload.details ?? {}),
    });

    const { data, error } = await this.supabaseClient
      .from('vehicles')
      .insert(columns)
      .select('id')
      .single();

    if (error || !data) {
      console.error('Failed to add vehicle', error);
      return null;
    }

    if (payload.maintenance?.length) {
      const maintenancePayload = payload.maintenance
        .filter((record) => this.hasMaintenanceContent(record))
        .map((record) => this.buildMaintenanceColumns(data.id, record));
      if (maintenancePayload.length > 0) {
        const { error: maintenanceError } = await this.supabaseClient
          .from('vehicle_maintenance_records')
          .insert(maintenancePayload);
        if (maintenanceError) {
          console.error('Failed to save maintenance records', maintenanceError);
        }
      }
    }

    await this.refreshVehicles();
    return this.vehiclesSubject.value.find((vehicle) => vehicle.id === data.id) ?? null;
  }

  async updateVehicle(
    id: string,
    updater: (vehicle: Vehicle) => Vehicle,
  ): Promise<Vehicle | null> {
    const existing = this.vehiclesSubject.value.find((vehicle) => vehicle.id === id);
    if (!existing) {
      return null;
    }

    const updated = updater(this.clone(existing));
    const columns = this.buildVehicleColumns({
      location: updated.location.trim(),
      name: updated.name.trim(),
      licensePlate: updated.licensePlate.trim().toUpperCase(),
      status: updated.status,
      details: updated.details,
    });

    const { error } = await this.supabaseClient
      .from('vehicles')
      .update({ ...columns, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to update vehicle', error);
      return null;
    }

    await this.refreshVehicles();
    return this.vehiclesSubject.value.find((vehicle) => vehicle.id === id) ?? null;
  }

  async removeVehicle(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('vehicles')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to remove vehicle', error);
      return;
    }

    await this.refreshVehicles();
  }

  async markVehicleStatus(id: string, status: VehicleStatus): Promise<void> {
    const { error } = await this.supabaseClient
      .from('vehicles')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to update vehicle status', error);
      return;
    }

    await this.refreshVehicles();
  }

  async addMaintenanceRecord(
    vehicleId: string,
    record: Omit<MaintenanceRecord, 'id'>,
  ): Promise<MaintenanceRecord | null> {
    const payload = this.buildMaintenanceColumns(vehicleId, record);
    const { data, error } = await this.supabaseClient
      .from('vehicle_maintenance_records')
      .insert(payload)
      .select('*')
      .single();

    if (error || !data) {
      console.error('Failed to add maintenance record', error);
      return null;
    }

    await this.refreshVehicles();
    const vehicle = this.vehiclesSubject.value.find((item) => item.id === vehicleId);
    return vehicle?.maintenance.find((item) => item.id === data.id) ?? null;
  }

  async updateMaintenanceRecord(
    vehicleId: string,
    recordId: string,
    updater: (record: MaintenanceRecord) => MaintenanceRecord,
  ): Promise<MaintenanceRecord | null> {
    const vehicle = this.vehiclesSubject.value.find((item) => item.id === vehicleId);
    const existing = vehicle?.maintenance.find((record) => record.id === recordId);
    if (!vehicle || !existing) {
      return null;
    }

    const updated = updater(this.clone(existing));
    const payload = this.buildMaintenanceColumns(vehicleId, updated);
    delete (payload as { vehicle_id?: string }).vehicle_id;

    const { error } = await this.supabaseClient
      .from('vehicle_maintenance_records')
      .update(payload)
      .eq('id', recordId);

    if (error) {
      console.error('Failed to update maintenance record', error);
      return null;
    }

    await this.refreshVehicles();
    const refreshed = this.vehiclesSubject.value
      .find((item) => item.id === vehicleId)
      ?.maintenance.find((record) => record.id === recordId);
    return refreshed ?? null;
  }

  async removeMaintenanceRecord(vehicleId: string, recordId: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('vehicle_maintenance_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Failed to remove maintenance record', error);
      return;
    }

    await this.refreshVehicles();
  }

  async toggleMaintenanceLock(vehicleId: string, recordId: string): Promise<void> {
    const vehicle = this.vehiclesSubject.value.find((item) => item.id === vehicleId);
    const record = vehicle?.maintenance.find((item) => item.id === recordId);
    if (!record) {
      return;
    }

    const { error } = await this.supabaseClient
      .from('vehicle_maintenance_records')
      .update({ locked: !record.locked })
      .eq('id', recordId);

    if (error) {
      console.error('Failed to toggle maintenance lock', error);
      return;
    }

    await this.refreshVehicles();
  }

  async importCsv(file: File): Promise<CsvImportResult> {
    const text = await file.text();
    const { vehicles, skipped, errors } = this.parseCsv(text);
    if (vehicles.length === 0) {
      return { added: 0, skipped, errors };
    }

    const existingByPlate = new Map(
      this.vehiclesSubject.value.map((vehicle) => [vehicle.licensePlate.toUpperCase(), vehicle]),
    );

    let added = 0;
    for (const vehicle of vehicles) {
      const key = vehicle.licensePlate.toUpperCase();
      const current = existingByPlate.get(key);
      if (current) {
        const merged = this.clone(current);
        this.mergeVehicle(merged, vehicle);
        const updateColumns = this.buildVehicleColumns({
          location: merged.location.trim(),
          name: merged.name.trim(),
          licensePlate: merged.licensePlate,
          status: merged.status,
          details: merged.details,
        });
        const { error } = await this.supabaseClient
          .from('vehicles')
          .update({ ...updateColumns, updated_at: new Date().toISOString() })
          .eq('id', current.id);
        if (error) {
          console.error('Failed to merge vehicle during import', error);
          continue;
        }

        const newMaintenance = vehicle.maintenance.filter(
          (record) =>
            !current.maintenance.some((existing) =>
              this.maintenanceRecordsEqual(existing, record),
            ),
        );
        if (newMaintenance.length > 0) {
          const maintenancePayload = newMaintenance.map((record) =>
            this.buildMaintenanceColumns(current.id, record),
          );
          const { error: maintenanceError } = await this.supabaseClient
            .from('vehicle_maintenance_records')
            .insert(maintenancePayload);
          if (maintenanceError) {
            console.error('Failed to import maintenance record', maintenanceError);
          }
        }
      } else {
        const columns = this.buildVehicleColumns({
          location: vehicle.location,
          name: vehicle.name,
          licensePlate: vehicle.licensePlate,
          status: vehicle.status,
          details: vehicle.details,
        });
        const { data, error } = await this.supabaseClient
          .from('vehicles')
          .insert(columns)
          .select('id, license_plate')
          .single();
        if (error || !data) {
          console.error('Failed to insert vehicle during import', error);
          continue;
        }
        added += 1;
        existingByPlate.set(data.license_plate.toUpperCase(), {
          ...vehicle,
          id: data.id,
          licensePlate: data.license_plate.toUpperCase(),
        });
        if (vehicle.maintenance.length > 0) {
          const maintenancePayload = vehicle.maintenance.map((record) =>
            this.buildMaintenanceColumns(data.id, record),
          );
          const { error: maintenanceError } = await this.supabaseClient
            .from('vehicle_maintenance_records')
            .insert(maintenancePayload);
          if (maintenanceError) {
            console.error('Failed to insert imported maintenance record', maintenanceError);
          }
        }
      }
    }

    await this.refreshVehicles();
    return { added, skipped, errors };
  }

  private async refreshVehicles(): Promise<void> {
    const { data, error } = await this.supabaseClient
      .from('vehicles')
      .select(this.vehicleSelect)
      .order('name', { ascending: true })
      .order('date', { foreignTable: 'vehicle_maintenance_records', ascending: false });

    if (error) {
      console.error('Failed to load vehicles from Supabase', error);
      return;
    }

    const vehicles = (data ?? []).map((row) => this.mapVehicle(row));
    this.vehiclesSubject.next(vehicles);
  }

  private mapVehicle(row: VehicleRow): Vehicle {
    const maintenance = (row.maintenance ?? []).map((record) => this.mapMaintenance(record));
    return {
      id: row.id,
      location: this.stringOrEmpty(row.location),
      name: this.stringOrEmpty(row.name),
      licensePlate: this.stringOrEmpty(row.license_plate).toUpperCase(),
      status: this.normaliseStatus(row.status),
      details: {
        purchaseDate: this.stringOrEmpty(row.purchase_date),
        vin: this.stringOrEmpty(row.vin),
        engine: this.stringOrEmpty(row.engine),
        chassis: this.stringOrEmpty(row.chassis),
        odometer: this.stringOrEmpty(row.odometer),
        fuelType: this.stringOrEmpty(row.fuel_type),
        transmission: this.stringOrEmpty(row.transmission),
        grossVehicleMass: this.stringOrEmpty(row.gross_vehicle_mass),
        notes: this.stringOrEmpty(row.notes),
      },
      maintenance: this.sortMaintenance(maintenance),
    };
  }

  private mapMaintenance(record: MaintenanceRow): MaintenanceRecord {
    return {
      id: record.id,
      date: this.stringOrEmpty(record.date),
      enteredBy: this.stringOrEmpty(record.entered_by),
      work: this.stringOrEmpty(record.work),
      odoReading: this.stringOrEmpty(record.odo_reading),
      performedAt: this.stringOrEmpty(record.performed_at),
      outcome: this.stringOrEmpty(record.outcome),
      cost: this.stringOrEmpty(record.cost),
      notes: this.stringOrEmpty(record.notes),
      locked: Boolean(record.locked),
    };
  }

  private buildVehicleColumns(data: {
    location: string;
    name: string;
    licensePlate: string;
    status: VehicleStatus;
    details: VehicleDetails;
  }): Record<string, unknown> {
    return {
      location: data.location,
      name: data.name,
      license_plate: data.licensePlate,
      status: data.status,
      purchase_date: this.nullIfEmpty(data.details.purchaseDate),
      vin: this.nullIfEmpty(data.details.vin),
      engine: this.nullIfEmpty(data.details.engine),
      chassis: this.nullIfEmpty(data.details.chassis),
      odometer: this.nullIfEmpty(data.details.odometer),
      fuel_type: this.nullIfEmpty(data.details.fuelType),
      transmission: this.nullIfEmpty(data.details.transmission),
      gross_vehicle_mass: this.nullIfEmpty(data.details.grossVehicleMass),
      notes: this.nullIfEmpty(data.details.notes),
    };
  }

  private buildVehicleDetails(partial: Partial<VehicleDetails>): VehicleDetails {
    return {
      purchaseDate: partial.purchaseDate ?? '',
      vin: partial.vin ?? '',
      engine: partial.engine ?? '',
      chassis: partial.chassis ?? '',
      odometer: partial.odometer ?? '',
      fuelType: partial.fuelType ?? '',
      transmission: partial.transmission ?? '',
      grossVehicleMass: partial.grossVehicleMass ?? '',
      notes: partial.notes ?? '',
    };
  }

  private buildMaintenanceColumns(
    vehicleId: string,
    record: Omit<MaintenanceRecord, 'id'> | MaintenanceRecord,
  ): Record<string, unknown> {
    return {
      vehicle_id: vehicleId,
      date: this.nullIfEmpty(record.date),
      entered_by: this.nullIfEmpty(record.enteredBy),
      work: this.nullIfEmpty(record.work),
      odo_reading: this.nullIfEmpty(record.odoReading),
      performed_at: this.nullIfEmpty(record.performedAt),
      outcome: this.nullIfEmpty(record.outcome),
      cost: this.nullIfEmpty(record.cost),
      notes: this.nullIfEmpty(record.notes),
      locked: record.locked ?? false,
    };
  }

  private normaliseStatus(value: string | null): VehicleStatus {
    switch (value) {
      case 'sold':
        return 'sold';
      case 'archived':
        return 'archived';
      default:
        return 'active';
    }
  }

  private sortMaintenance(records: MaintenanceRecord[]): MaintenanceRecord[] {
    return [...records].sort((a, b) => b.date.localeCompare(a.date));
  }

  private stringOrEmpty(value: string | null | undefined): string {
    return value?.trim() ?? '';
  }

  private nullIfEmpty(value: string | null | undefined): string | null {
    const trimmed = value?.trim() ?? '';
    return trimmed.length > 0 ? trimmed : null;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
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
    if (matches(/(?:^|_)(date|performed|completed)(?:_|$)/)) {
      return 'date';
    }
    if (matches(/(?:^|_)(entered_by|enteredby|author|user)(?:_|$)/)) {
      return 'enteredBy';
    }
    if (matches(/(?:^|_)(work|description|summary|task)(?:_|$)/)) {
      return 'work';
    }
    if (matches(/(?:^|_)(odo|odometer|mileage|km)(?:_|$)/)) {
      return 'odoReading';
    }
    if (matches(/(?:^|_)(performed_at|provider|vendor|mechanic|location)(?:_|$)/)) {
      return 'performedAt';
    }
    if (matches(/(?:^|_)(outcome|result|status)(?:_|$)/)) {
      return 'outcome';
    }
    if (matches(/(?:^|_)(cost|amount|price|total)(?:_|$)/)) {
      return 'cost';
    }
    if (matches(/(?:^|_)(note|comment|remark)(?:_|$)/)) {
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
}
