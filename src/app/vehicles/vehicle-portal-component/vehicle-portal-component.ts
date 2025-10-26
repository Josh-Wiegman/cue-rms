import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import {
  CsvImportResult,
  VehicleDataService,
} from '../services/vehicle-data.service';
import {
  MaintenanceRecord,
  Vehicle,
  VehicleStatus,
} from '../models/vehicle.model';

@Component({
  selector: 'vehicle-portal-component',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, UiShellComponent],
  templateUrl: './vehicle-portal-component.html',
  styleUrl: './vehicle-portal-component.scss',
})
export class VehiclePortalComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly vehicleData = inject(VehicleDataService);
  private readonly destroyRef = inject(DestroyRef);

  vehicles = signal<Vehicle[]>([]);
  selectedVehicleId = signal<string | null>(null);
  authLevel = signal<1 | 2>(2);
  showAddVehicleModal = signal(false);
  showAddMaintenanceModal = signal(false);

  readonly selectedVehicle = computed(() =>
    this.vehicles().find((vehicle) => vehicle.id === this.selectedVehicleId()) ??
    null,
  );

  readonly activeVehicles = computed(() =>
    this.vehicles().filter((vehicle) => vehicle.status === 'active').length,
  );
  readonly soldVehicles = computed(() =>
    this.vehicles().filter((vehicle) => vehicle.status === 'sold').length,
  );
  readonly archivedVehicles = computed(() =>
    this.vehicles().filter((vehicle) => vehicle.status === 'archived').length,
  );

  readonly newVehicleForm = this.fb.nonNullable.group({
    location: ['', [Validators.required, Validators.maxLength(60)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    licensePlate: ['', [Validators.required, Validators.maxLength(12)]],
    purchaseDate: [''],
    vin: [''],
    engine: [''],
    chassis: [''],
    odometer: [''],
    fuelType: [''],
    transmission: [''],
    grossVehicleMass: [''],
    notes: [''],
    status: this.fb.nonNullable.control<VehicleStatus>('active'),
  });

  readonly vehicleDetailsForm = this.fb.nonNullable.group({
    location: ['', [Validators.required, Validators.maxLength(60)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    licensePlate: ['', [Validators.required, Validators.maxLength(12)]],
    purchaseDate: [''],
    vin: [''],
    engine: [''],
    chassis: [''],
    odometer: [''],
    fuelType: [''],
    transmission: [''],
    grossVehicleMass: [''],
    notes: [''],
    status: this.fb.nonNullable.control<VehicleStatus>('active'),
  });

  readonly maintenanceForm = this.fb.nonNullable.group({
    date: ['', Validators.required],
    enteredBy: ['', Validators.required],
    work: ['', Validators.required],
    odoReading: [''],
    performedAt: [''],
    outcome: [''],
    cost: [''],
    notes: [''],
  });

  editingMaintenanceId = signal<string | null>(null);
  maintenanceEditForm = this.fb.nonNullable.group({
    date: ['', Validators.required],
    enteredBy: ['', Validators.required],
    work: ['', Validators.required],
    odoReading: [''],
    performedAt: [''],
    outcome: [''],
    cost: [''],
    notes: [''],
  });

  csvImportSummary = signal<string>('');
  csvImportErrors = signal<string[]>([]);

  private readonly syncFormEffect = effect(() => {
    const selected = this.selectedVehicle();
    if (selected) {
      this.vehicleDetailsForm.patchValue({
        location: selected.location,
        name: selected.name,
        licensePlate: selected.licensePlate,
        purchaseDate: selected.details.purchaseDate,
        vin: selected.details.vin,
        engine: selected.details.engine,
        chassis: selected.details.chassis,
        odometer: selected.details.odometer,
        fuelType: selected.details.fuelType,
        transmission: selected.details.transmission,
        grossVehicleMass: selected.details.grossVehicleMass,
        notes: selected.details.notes,
        status: selected.status,
      });
    }
  });

  ngOnInit(): void {
    this.vehicleData.vehicles$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((vehicles) => {
        this.vehicles.set(vehicles);
        if (vehicles.length > 0 && !this.selectedVehicleId()) {
          this.selectedVehicleId.set(vehicles[0].id);
        }
        if (
          vehicles.length > 0 &&
          this.selectedVehicleId() &&
          !vehicles.some((vehicle) => vehicle.id === this.selectedVehicleId())
        ) {
          this.selectedVehicleId.set(vehicles[0].id);
        }
      });
  }

  trackByVehicleId(_: number, vehicle: Vehicle): string {
    return vehicle.id;
  }

  trackByMaintenance(_: number, record: MaintenanceRecord): string {
    return record.id;
  }

  selectVehicle(vehicle: Vehicle): void {
    this.selectedVehicleId.set(vehicle.id);
  }

  canEditCoreDetails(): boolean {
    return this.authLevel() === 1;
  }

  canEditMaintenance(record: MaintenanceRecord): boolean {
    if (this.authLevel() === 1) {
      return true;
    }
    return !record.locked;
  }

  changeAuthLevel(level: '1' | '2'): void {
    this.authLevel.set(level === '1' ? 1 : 2);
  }

  handleAuthLevelChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (!select) {
      return;
    }
    const value = select.value === '1' ? '1' : '2';
    this.changeAuthLevel(value);
  }

  openAddVehicleModal(): void {
    this.resetNewVehicleForm();
    this.showAddVehicleModal.set(true);
  }

  closeAddVehicleModal(): void {
    this.showAddVehicleModal.set(false);
  }

  openAddMaintenanceModal(): void {
    if (!this.selectedVehicle()) {
      return;
    }
    this.resetMaintenanceForm();
    this.showAddMaintenanceModal.set(true);
  }

  closeAddMaintenanceModal(): void {
    this.showAddMaintenanceModal.set(false);
  }

  private resetNewVehicleForm(): void {
    this.newVehicleForm.reset({
      location: '',
      name: '',
      licensePlate: '',
      purchaseDate: '',
      vin: '',
      engine: '',
      chassis: '',
      odometer: '',
      fuelType: '',
      transmission: '',
      grossVehicleMass: '',
      notes: '',
      status: 'active',
    });
  }

  private resetMaintenanceForm(): void {
    this.maintenanceForm.reset({
      date: '',
      enteredBy: '',
      work: '',
      odoReading: '',
      performedAt: '',
      outcome: '',
      cost: '',
      notes: '',
    });
  }

  private normalizeFieldValue(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    const normalized = String(value).trim();
    return normalized;
  }

  addVehicle(): void {
    if (this.newVehicleForm.invalid) {
      this.newVehicleForm.markAllAsTouched();
      return;
    }

    const value = this.newVehicleForm.getRawValue();
    const vehicle = this.vehicleData.addVehicle({
      location: value.location,
      name: value.name,
      licensePlate: value.licensePlate,
      status: value.status,
      details: {
        purchaseDate: value.purchaseDate,
        vin: value.vin,
        engine: value.engine,
        chassis: value.chassis,
        odometer: this.normalizeFieldValue(value.odometer),
        fuelType: value.fuelType,
        transmission: value.transmission,
        grossVehicleMass: this.normalizeFieldValue(value.grossVehicleMass),
        notes: value.notes,
      },
    });

    this.resetNewVehicleForm();
    this.selectedVehicleId.set(vehicle.id);
    this.closeAddVehicleModal();
  }

  saveVehicleDetails(): void {
    if (!this.selectedVehicle()) {
      return;
    }
    if (this.vehicleDetailsForm.invalid) {
      this.vehicleDetailsForm.markAllAsTouched();
      return;
    }

    const value = this.vehicleDetailsForm.getRawValue();
    this.vehicleData.updateVehicle(this.selectedVehicle()!.id, (vehicle) => ({
      ...vehicle,
      location: value.location,
      name: value.name,
      licensePlate: value.licensePlate.toUpperCase(),
      status: value.status,
      details: {
        ...vehicle.details,
        purchaseDate: value.purchaseDate,
        vin: value.vin,
        engine: value.engine,
        chassis: value.chassis,
        odometer: this.normalizeFieldValue(value.odometer),
        fuelType: value.fuelType,
        transmission: value.transmission,
        grossVehicleMass: this.normalizeFieldValue(value.grossVehicleMass),
        notes: value.notes,
      },
    }));
  }

  markVehicleStatus(status: VehicleStatus): void {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return;
    }
    this.vehicleData.markVehicleStatus(vehicle.id, status);
  }

  addMaintenance(): void {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return;
    }
    if (this.maintenanceForm.invalid) {
      this.maintenanceForm.markAllAsTouched();
      return;
    }

    const value = this.maintenanceForm.getRawValue();
    this.vehicleData.addMaintenanceRecord(vehicle.id, {
      date: value.date,
      enteredBy: value.enteredBy,
      work: value.work,
      odoReading: this.normalizeFieldValue(value.odoReading),
      performedAt: value.performedAt,
      outcome: value.outcome,
      cost: this.normalizeFieldValue(value.cost),
      notes: value.notes,
      locked: false,
    });

    this.resetMaintenanceForm();
    this.closeAddMaintenanceModal();
  }

  startEditMaintenance(record: MaintenanceRecord): void {
    if (!this.canEditMaintenance(record)) {
      return;
    }
    this.editingMaintenanceId.set(record.id);
    this.maintenanceEditForm.setValue({
      date: record.date,
      enteredBy: record.enteredBy,
      work: record.work,
      odoReading: record.odoReading,
      performedAt: record.performedAt,
      outcome: record.outcome,
      cost: record.cost,
      notes: record.notes,
    });
  }

  cancelMaintenanceEdit(): void {
    this.editingMaintenanceId.set(null);
  }

  saveMaintenanceEdit(record: MaintenanceRecord): void {
    if (this.maintenanceEditForm.invalid) {
      this.maintenanceEditForm.markAllAsTouched();
      return;
    }

    const value = this.maintenanceEditForm.getRawValue();
    this.vehicleData.updateMaintenanceRecord(
      this.selectedVehicle()!.id,
      record.id,
      () => ({
        ...record,
        date: value.date,
        enteredBy: value.enteredBy,
        work: value.work,
        odoReading: this.normalizeFieldValue(value.odoReading),
        performedAt: value.performedAt,
        outcome: value.outcome,
        cost: this.normalizeFieldValue(value.cost),
        notes: value.notes,
      }),
    );
    this.editingMaintenanceId.set(null);
  }

  toggleMaintenanceLock(record: MaintenanceRecord): void {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return;
    }
    if (this.authLevel() !== 1) {
      return;
    }
    this.vehicleData.toggleMaintenanceLock(vehicle.id, record.id);
  }

  async importCsv(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const result: CsvImportResult = await this.vehicleData.importCsv(file);
    const skippedText = result.skipped > 0 ? `, ${result.skipped} skipped` : '';
    this.csvImportSummary.set(
      `${result.added} vehicle${result.added === 1 ? '' : 's'} imported${skippedText}`,
    );
    this.csvImportErrors.set(result.errors);
    input.value = '';
  }

  maintenanceRowClass(record: MaintenanceRecord): string {
    const classes: string[] = [];
    if (record.locked) {
      classes.push('locked');
    }
    if (record.outcome.toLowerCase().includes('fail')) {
      classes.push('failed');
    }
    return classes.join(' ');
  }
}
