// src/app/vehicles/data/vehicle-data.service.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  MaintenanceRecord,
  Vehicle,
  VehicleDetails,
  VehicleStatus,
} from '../models/vehicle.model';
import { SupabaseService } from '../../shared/supabase-service/supabase.service';
import { AuthService } from '../../auth/auth.service'; // adjust path if needed
import { parseVehicleCsv } from './vehicle-csv.parser';

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

interface VehicleListApiResponse {
  ok: boolean;
  items?: VehicleRow[];
  vehicle?: VehicleRow;
  error?: string;
}

interface VehicleMutationApiResponse {
  ok: boolean;
  vehicle?: VehicleRow;
  id?: string;
  error?: string;
}

interface MaintenanceMutationApiResponse {
  ok: boolean;
  record?: MaintenanceRow;
  id?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class VehicleDataService {
  private readonly vehiclesSubject = new BehaviorSubject<Vehicle[]>([]);
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  private readonly baseUrl: string;
  private readonly orgSlug = 'gravity';
  private readonly anonKey = environment.supabaseKey ?? '';

  // Will be computed from user on auth changes
  private authLevel: 1 | 2 = 1;

  private authSub?: Subscription;
  readonly vehicles$ = this.vehiclesSubject.asObservable();

  constructor() {
    this.baseUrl = this.buildBaseUrl();

    this.authSub = this.authService.currentUser$.subscribe(async (user) => {
      this.authLevel = this.computeAuthLevelFromUser(user);

      if (user) {
        await this.refreshVehicles();
      } else {
        this.vehiclesSubject.next([]);
      }
    });
  }

  private computeAuthLevelFromUser(user: any): 1 | 2 {
    if (!user) return 1;

    const lvl =
      user.permissionLevel ??
      user.user_metadata?.permissionLevel ??
      user.app_metadata?.permissionLevel ??
      user.metadata?.permissionLevel ??
      null;

    const roles: string[] =
      user.roles ?? user.app_metadata?.roles ?? user.user_metadata?.roles ?? [];

    const isAdminByNumber = lvl === 1 || lvl === 3;
    const isAdminByRole = Array.isArray(roles) && roles.includes('admin');

    return isAdminByNumber || isAdminByRole ? 2 : 1;
  }

  async addVehicle(payload: VehicleInput): Promise<Vehicle | null> {
    const maintenancePayload = (payload.maintenance ?? [])
      .filter((record) => this.hasMaintenanceContent(record))
      .map((record) => this.buildMaintenanceColumns(undefined, record));

    const columns = this.buildVehicleColumns({
      location: payload.location.trim(),
      name: payload.name.trim(),
      licensePlate: payload.licensePlate.trim().toUpperCase(),
      status: payload.status ?? 'active',
      details: this.buildVehicleDetails(payload.details ?? {}),
    });

    const response = await this.request<VehicleMutationApiResponse>(
      'POST',
      '',
      {
        body: { ...columns, maintenance: maintenancePayload },
      },
    );

    const createdId = response?.vehicle?.id;
    if (!response?.ok || !createdId) return null;

    await this.refreshVehicles();
    return this.vehiclesSubject.value.find((v) => v.id === createdId) ?? null;
  }

  async updateVehicle(
    id: string,
    updater: (vehicle: Vehicle) => Vehicle,
  ): Promise<Vehicle | null> {
    const existing = this.vehiclesSubject.value.find((v) => v.id === id);
    if (!existing) return null;

    const updated = updater(this.clone(existing));
    const columns = this.buildVehicleColumns({
      location: updated.location.trim(),
      name: updated.name.trim(),
      licensePlate: updated.licensePlate.trim().toUpperCase(),
      status: updated.status,
      details: updated.details,
    });

    const response = await this.request<VehicleMutationApiResponse>('PUT', '', {
      body: { id, ...columns },
    });
    if (!response?.ok) return null;

    await this.refreshVehicles();
    return this.vehiclesSubject.value.find((v) => v.id === id) ?? null;
  }

  async removeVehicle(id: string): Promise<void> {
    const response = await this.request<VehicleMutationApiResponse>(
      'DELETE',
      '',
      {
        body: { id },
      },
    );
    if (!response?.ok) return;
    await this.refreshVehicles();
  }

  async markVehicleStatus(id: string, status: VehicleStatus): Promise<void> {
    const response = await this.request<VehicleMutationApiResponse>('PUT', '', {
      body: { id, status },
    });
    if (!response?.ok) return;
    await this.refreshVehicles();
  }

  async addMaintenanceRecord(
    vehicleId: string,
    record: Omit<MaintenanceRecord, 'id'>,
  ): Promise<MaintenanceRecord | null> {
    const payload = this.buildMaintenanceColumns(vehicleId, record);
    const response = await this.request<MaintenanceMutationApiResponse>(
      'POST',
      'maintenance',
      { body: payload },
    );
    if (!response?.ok) return null;

    await this.refreshVehicles();
    const vehicle = this.vehiclesSubject.value.find((x) => x.id === vehicleId);
    const insertedId = response.record?.id ?? response.id;
    return vehicle?.maintenance.find((m) => m.id === insertedId) ?? null;
  }

  async updateMaintenanceRecord(
    vehicleId: string,
    recordId: string,
    updater: (record: MaintenanceRecord) => MaintenanceRecord,
  ): Promise<MaintenanceRecord | null> {
    const vehicle = this.vehiclesSubject.value.find((x) => x.id === vehicleId);
    const existing = vehicle?.maintenance.find((m) => m.id === recordId);
    if (!vehicle || !existing) return null;

    const updated = updater(this.clone(existing));
    const payload = this.buildMaintenanceColumns(undefined, updated);
    const response = await this.request<MaintenanceMutationApiResponse>(
      'PUT',
      'maintenance',
      { body: { id: recordId, ...payload } },
    );
    if (!response?.ok) return null;

    await this.refreshVehicles();
    return (
      this.vehiclesSubject.value
        .find((x) => x.id === vehicleId)
        ?.maintenance.find((m) => m.id === recordId) ?? null
    );
  }

  async removeMaintenanceRecord(
    vehicleId: string,
    recordId: string,
  ): Promise<void> {
    const response = await this.request<MaintenanceMutationApiResponse>(
      'DELETE',
      'maintenance',
      { body: { id: recordId } },
    );
    if (!response?.ok) return;
    await this.refreshVehicles();
  }

  async toggleMaintenanceLock(
    vehicleId: string,
    recordId: string,
  ): Promise<void> {
    const vehicle = this.vehiclesSubject.value.find((x) => x.id === vehicleId);
    const record = vehicle?.maintenance.find((m) => m.id === recordId);
    if (!record) return;

    const response = await this.request<MaintenanceMutationApiResponse>(
      'PUT',
      'maintenance',
      { body: { id: recordId, locked: !record.locked } },
    );
    if (!response?.ok) return;

    await this.refreshVehicles();
  }

  /* =======================
     CSV IMPORT (updated)
     ======================= */
  async importCsv(file: File): Promise<CsvImportResult> {
    const text = await file.text();

    // ⬇️ Use the new robust parser (handles blob-in-A1 + table)
    const { vehicles, skipped, errors } = parseVehicleCsv(text, file.name, {
      defaultLocation: 'Dunedin',
      defaultPurchaseDateToToday: true,
    });

    if (vehicles.length === 0) return { added: 0, skipped, errors };

    const existingByPlate = new Map(
      this.vehiclesSubject.value.map((v) => [v.licensePlate.toUpperCase(), v]),
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
        const updateResponse = await this.request<VehicleMutationApiResponse>(
          'PUT',
          '',
          { body: { id: current.id, ...updateColumns } },
        );
        if (!updateResponse?.ok) {
          console.error('Failed to merge vehicle during import');
          continue;
        }

        const newMaintenance = vehicle.maintenance.filter(
          (r) =>
            !current.maintenance.some((e) =>
              this.maintenanceRecordsEqual(e, r),
            ),
        );
        for (const record of newMaintenance) {
          const maintenancePayload = this.buildMaintenanceColumns(
            current.id,
            record,
          );
          const maintenanceResponse =
            await this.request<MaintenanceMutationApiResponse>(
              'POST',
              'maintenance',
              { body: maintenancePayload },
            );
          if (!maintenanceResponse?.ok) {
            console.error('Failed to import maintenance record');
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
        const maintenancePayload = vehicle.maintenance.map((r) =>
          this.buildMaintenanceColumns(undefined, r),
        );
        const response = await this.request<VehicleMutationApiResponse>(
          'POST',
          '',
          { body: { ...columns, maintenance: maintenancePayload } },
        );
        if (!response?.ok || !response.vehicle?.id) {
          console.error('Failed to insert vehicle during import');
          continue;
        }
        added += 1;
        existingByPlate.set(vehicle.licensePlate.toUpperCase(), {
          ...vehicle,
          id: response.vehicle.id,
          licensePlate: vehicle.licensePlate.toUpperCase(),
        });
      }
    }

    await this.refreshVehicles();
    return { added, skipped, errors };
  }

  /* ===== REST OF SERVICE (unchanged) ===== */

  private async refreshVehicles(): Promise<void> {
    const response = await this.request<VehicleListApiResponse>('GET', '', {
      query: { include: 'maintenance' },
    });
    if (!response?.ok) return;

    const rows = response.items ?? (response.vehicle ? [response.vehicle] : []);
    const vehicles = rows.map((row) => this.mapVehicle(row));
    this.vehiclesSubject.next(vehicles);
  }

  private buildBaseUrl(): string {
    const root = environment.supabaseDataUrl.replace(/\/+$/, '');
    return `${root}/functions/v1/vehicles`;
  }

  private async request<T extends { ok: boolean; error?: string }>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    options?: { query?: Record<string, unknown>; body?: unknown },
  ): Promise<T | null> {
    const base = this.baseUrl + (this.baseUrl.endsWith('/') ? '' : '/');
    const safePath = (path ?? '').replace(/^\/+/, '');
    const target = new URL(safePath, base);

    const query = options?.query ?? {};
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      target.searchParams.set(key, String(value));
    }

    const { data } = await this.supabaseService.client.auth.getSession();
    const accessToken = data.session?.access_token;

    const headers: Record<string, string> = {
      'x-auth-level': String(this.authLevel),
      'x-org-slug': this.orgSlug,
      apikey: this.anonKey,
      authorization: `Bearer ${accessToken ?? this.anonKey}`,
    };

    let body: string | undefined;
    if (options?.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(target.toString(), {
        method,
        headers,
        body,
      });
      if (!response.ok) {
        let errorDetails: string | undefined;
        try {
          errorDetails = (await response.json())?.error;
        } catch {
          /* ignore */
        }
        console.error(
          `Vehicle API ${method} ${target.pathname} failed`,
          errorDetails ?? response.statusText,
        );
        return null;
      }
      if (response.status === 204) return { ok: true } as T;
      const dataJson = (await response.json()) as T;
      if (!dataJson.ok) {
        console.error(
          `Vehicle API ${method} ${target.pathname} returned error`,
          dataJson.error,
        );
        return null;
      }
      return dataJson;
    } catch (error) {
      console.error(
        `Vehicle API ${method} ${target.pathname} exception`,
        error,
      );
      return null;
    }
  }

  private mapVehicle(row: VehicleRow): Vehicle {
    const maintenance = (row.maintenance ?? []).map((r) =>
      this.mapMaintenance(r),
    );
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

  private buildVehicleDetails(
    partial: Partial<VehicleDetails>,
  ): VehicleDetails {
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
    vehicleId: string | undefined,
    record: Omit<MaintenanceRecord, 'id'> | MaintenanceRecord,
  ): Record<string, unknown> {
    const payload: Record<string, unknown> = {
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
    if (vehicleId) payload['vehicle_id'] = vehicleId;
    return payload;
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

  /* ------------ merge helpers (unchanged) ------------ */

  private mergeVehicle(target: Vehicle, source: Vehicle): void {
    if (source.name && source.name.length > target.name.length)
      target.name = source.name;

    if (source.location && source.location !== 'Unassigned') {
      const shouldUpdate =
        !target.location ||
        target.location === 'Unassigned' ||
        source.location.length > target.location.length;
      if (shouldUpdate) target.location = source.location;
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
    target.maintenance = this.mergeMaintenanceRecords(
      target.maintenance,
      source.maintenance,
    );
  }

  private mergeVehicleDetails(
    target: VehicleDetails,
    source: VehicleDetails,
  ): VehicleDetails {
    const merged: VehicleDetails = { ...target };
    (Object.keys(source) as (keyof VehicleDetails)[]).forEach((key) => {
      const targetValue = merged[key]?.trim() ?? '';
      const sourceValue = source[key]?.trim() ?? '';
      if (!targetValue && sourceValue) merged[key] = sourceValue;
    });
    return merged;
  }

  private mergeMaintenanceRecords(
    existing: MaintenanceRecord[],
    incoming: MaintenanceRecord[],
  ): MaintenanceRecord[] {
    if (!incoming.length) return existing;
    const merged = [...existing];
    incoming.forEach((record) => {
      const hasDuplicate = merged.some((e) =>
        this.maintenanceRecordsEqual(e, record),
      );
      if (!hasDuplicate) merged.push(record);
    });
    return merged;
  }

  private maintenanceRecordsEqual(
    a: MaintenanceRecord,
    b: MaintenanceRecord,
  ): boolean {
    const normalise = (v: string) => (v ?? '').toString().trim().toLowerCase();
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
    ].some((v) => (v ?? '').toString().trim().length > 0);
  }
}
