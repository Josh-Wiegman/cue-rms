import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild,
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
  showAddVehicleMenu = signal(false);
  showImportCsvModal = signal(false);
  selectedCsvFile = signal<File | null>(null);

  readonly isAdmin = computed(() => this.authLevel() === 1);
  readonly selectedVehicle = computed(
    () =>
      this.vehicles().find(
        (vehicle) => vehicle.id === this.selectedVehicleId(),
      ) ?? null,
  );

  readonly activeVehicles = computed(
    () =>
      this.vehicles().filter((vehicle) => vehicle.status === 'active').length,
  );
  readonly soldVehicles = computed(
    () => this.vehicles().filter((vehicle) => vehicle.status === 'sold').length,
  );
  readonly archivedVehicles = computed(
    () =>
      this.vehicles().filter((vehicle) => vehicle.status === 'archived').length,
  );

  readonly selectedCsvFileName = computed(
    () => this.selectedCsvFile()?.name ?? '',
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

  @ViewChild('csvFileInput')
  private csvFileInput?: ElementRef<HTMLInputElement>;

  private readonly syncFormEffect = effect(() => {
    const selected = this.selectedVehicle();
    if (selected) {
      this.vehicleDetailsForm.patchValue({
        location: selected.location,
        name: selected.name,
        licensePlate: selected.licensePlate,
        purchaseDate: new Date(selected.details.purchaseDate)
          .toISOString()
          .split('T')[0],
        vin: selected.details.vin,
        engine: selected.details.engine,
        chassis: selected.details.chassis,
        odometer: selected.details.odometer,
        fuelType: selected.details.fuelType,
        transmission: selected.details.transmission,
        grossVehicleMass: selected.details.grossVehicleMass,
        notes: selected.details.notes,
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
    return this.isAdmin();
  }

  canEditMaintenance(record: MaintenanceRecord): boolean {
    if (this.isAdmin()) {
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
    this.showAddVehicleMenu.set(false);
  }

  closeAddVehicleModal(): void {
    this.showAddVehicleModal.set(false);
  }

  handleAddVehicleClick(): void {
    this.openAddVehicleModal();
  }

  toggleAddVehicleMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.showAddVehicleMenu.update((value) => !value);
  }

  async handleRemoveVehicle(
    vehicle: Vehicle,
    event: MouseEvent,
  ): Promise<void> {
    event.stopPropagation();
    if (!this.isAdmin()) {
      return;
    }

    const isSelected = this.selectedVehicleId() === vehicle.id;
    if (isSelected) {
      this.selectedVehicleId.set(null);
    }

    await this.vehicleData.removeVehicle(vehicle.id);
  }

  handleVehicleMenuSelect(action: 'new' | 'import'): void {
    this.showAddVehicleMenu.set(false);
    if (action === 'new') {
      this.openAddVehicleModal();
      return;
    }
    this.openImportCsvModal();
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

  openImportCsvModal(): void {
    this.csvImportSummary.set('');
    this.csvImportErrors.set([]);
    this.selectedCsvFile.set(null);
    if (this.csvFileInput) {
      this.csvFileInput.nativeElement.value = '';
    }
    this.showImportCsvModal.set(true);
  }

  closeImportCsvModal(): void {
    this.showImportCsvModal.set(false);
    this.selectedCsvFile.set(null);
    if (this.csvFileInput) {
      this.csvFileInput.nativeElement.value = '';
    }
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

  private normalizeFieldValue(
    value: string | number | null | undefined,
  ): string {
    if (value === null || value === undefined) {
      return '';
    }
    const normalized = String(value).trim();
    return normalized;
  }

  async addVehicle(): Promise<void> {
    if (this.newVehicleForm.invalid) {
      this.newVehicleForm.markAllAsTouched();
      return;
    }

    const value = this.newVehicleForm.getRawValue();
    const vehicle = await this.vehicleData.addVehicle({
      location: value.location,
      name: value.name,
      licensePlate: value.licensePlate,
      details: {
        purchaseDate: new Date(value.purchaseDate).toISOString().split('T')[0],
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
    if (vehicle) {
      this.selectedVehicleId.set(vehicle.id);
    }
    this.closeAddVehicleModal();
  }

  async saveVehicleDetails(): Promise<void> {
    if (!this.selectedVehicle()) {
      return;
    }
    if (this.vehicleDetailsForm.invalid) {
      this.vehicleDetailsForm.markAllAsTouched();
      return;
    }

    const value = this.vehicleDetailsForm.getRawValue();
    await this.vehicleData.updateVehicle(
      this.selectedVehicle()!.id,
      (vehicle) => ({
        ...vehicle,
        location: value.location,
        name: value.name,
        licensePlate: value.licensePlate.toUpperCase(),
        details: {
          ...vehicle.details,
          purchaseDate: new Date(value.purchaseDate)
            .toISOString()
            .split('T')[0],
          vin: value.vin,
          engine: value.engine,
          chassis: value.chassis,
          odometer: this.normalizeFieldValue(value.odometer),
          fuelType: value.fuelType,
          transmission: value.transmission,
          grossVehicleMass: this.normalizeFieldValue(value.grossVehicleMass),
          notes: value.notes,
        },
      }),
    );
  }

  async markVehicleStatus(status: VehicleStatus): Promise<void> {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return;
    }
    await this.vehicleData.markVehicleStatus(vehicle.id, status);
  }

  exportSelectedVehicle(): void {
    const vehicle = this.selectedVehicle();
    if (
      !vehicle ||
      typeof window === 'undefined' ||
      typeof document === 'undefined'
    ) {
      return;
    }

    const lines: string[] = [];
    const append = (fields: string[]): void => {
      lines.push(fields.map((field) => this.escapeCsvValue(field)).join(','));
    };

    append(['Vehicle Details']);
    append(['Field', 'Value']);
    append(['Name', vehicle.name]);
    append(['License plate', vehicle.licensePlate]);
    append(['Location', vehicle.location]);
    append(['Status', vehicle.status]);
    append(['Purchase date', vehicle.details.purchaseDate]);
    append(['VIN', vehicle.details.vin]);
    append(['Engine', vehicle.details.engine]);
    append(['Chassis', vehicle.details.chassis]);
    append(['Odometer', vehicle.details.odometer]);
    append(['Fuel type', vehicle.details.fuelType]);
    append(['Transmission', vehicle.details.transmission]);
    append(['Gross vehicle mass', vehicle.details.grossVehicleMass]);
    append(['Notes', vehicle.details.notes]);

    lines.push('');
    append(['Maintenance Records']);
    append([
      'Date',
      'Entered by',
      'Work',
      'ODO',
      'Performed at',
      'Outcome',
      'Cost',
      'Notes',
      'Locked',
    ]);

    if (vehicle.maintenance.length === 0) {
      append(['None', '', '', '', '', '', '', '', '']);
    } else {
      vehicle.maintenance.forEach((record) => {
        append([
          record.date,
          record.enteredBy,
          record.work,
          record.odoReading,
          record.performedAt,
          record.outcome,
          record.cost,
          record.notes,
          record.locked ? 'Yes' : 'No',
        ]);
      });
    }

    const blob = new Blob([lines.join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vehicle-${vehicle.licensePlate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async addMaintenance(): Promise<void> {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return;
    }
    if (this.maintenanceForm.invalid) {
      this.maintenanceForm.markAllAsTouched();
      return;
    }

    const value = this.maintenanceForm.getRawValue();
    await this.vehicleData.addMaintenanceRecord(vehicle.id, {
      date: new Date(value.date).toISOString().split('T')[0],
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
      date: new Date(record.date).toISOString().split('T')[0],
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

  async saveMaintenanceEdit(record: MaintenanceRecord): Promise<void> {
    if (this.maintenanceEditForm.invalid) {
      this.maintenanceEditForm.markAllAsTouched();
      return;
    }

    const value = this.maintenanceEditForm.getRawValue();
    await this.vehicleData.updateMaintenanceRecord(
      this.selectedVehicle()!.id,
      record.id,
      () => ({
        ...record,
        date: new Date(value.date).toISOString().split('T')[0],
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

  async toggleMaintenanceLock(record: MaintenanceRecord): Promise<void> {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return;
    }
    if (!this.isAdmin()) {
      return;
    }
    await this.vehicleData.toggleMaintenanceLock(vehicle.id, record.id);
  }

  async handleDeleteMaintenance(
    record: MaintenanceRecord,
    event: MouseEvent,
  ): Promise<void> {
    event.stopPropagation();
    const vehicle = this.selectedVehicle();
    if (!vehicle || !this.isAdmin()) {
      return;
    }

    if (this.editingMaintenanceId() === record.id) {
      this.cancelMaintenanceEdit();
    }

    await this.vehicleData.removeMaintenanceRecord(vehicle.id, record.id);
  }

  handleCsvFileSelection(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.selectedCsvFile.set(file);
    this.csvImportSummary.set('');
    this.csvImportErrors.set([]);
  }

  async importSelectedCsv(): Promise<void> {
    const file = this.selectedCsvFile();
    if (!file) {
      this.csvImportErrors.set(['Please choose a CSV file to import.']);
      return;
    }

    const result: CsvImportResult = await this.vehicleData.importCsv(file);
    const skippedText = result.skipped > 0 ? `, ${result.skipped} skipped` : '';
    this.csvImportSummary.set(
      `${result.added} vehicle${result.added === 1 ? '' : 's'} imported${skippedText}`,
    );
    this.csvImportErrors.set(result.errors);

    if (result.errors.length === 0) {
      this.selectedCsvFile.set(null);
      if (this.csvFileInput) {
        this.csvFileInput.nativeElement.value = '';
      }
    }
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

  private escapeCsvValue(value: string): string {
    const safeValue = value ?? '';
    if (/[",\r\n]/.test(safeValue)) {
      return `"${safeValue.replace(/"/g, '""')}"`;
    }
    return safeValue;
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    if (!this.showAddVehicleMenu()) {
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target?.closest('.panel__header-action-group')) {
      return;
    }
    this.showAddVehicleMenu.set(false);
  }
}
