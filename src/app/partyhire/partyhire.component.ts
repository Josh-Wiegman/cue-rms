import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormsModule,
  ReactiveFormsModule,
  FormArray,
  FormBuilder,
  Validators,
} from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { UiShellComponent } from '../shared/ui-shell/ui-shell-component';
import {
  PartyHireOrder,
  PartyHireOrderStatus,
  PartyHireStockItem,
} from './partyhire.models';
import { PartyHireService } from './partyhire.service';

@Component({
  selector: 'partyhire-component',
  standalone: true,
  imports: [
    UiShellComponent,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    CurrencyPipe,
    DatePipe,
  ],
  templateUrl: './partyhire.component.html',
  styleUrl: './partyhire.component.scss',
})
export class PartyHireComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly partyHireService = inject(PartyHireService);

  protected inventory: PartyHireStockItem[] = [];
  protected orders: PartyHireOrder[] = [];
  protected selectedPrintId: string | null = null;
  protected calendarMessage = '';
  protected readonly statusOptions: PartyHireOrderStatus[] = [
    'Prepped',
    'Collected',
    'Returned',
    'Partial Return',
    'Missing',
  ];
  protected readonly statusDescription: Record<PartyHireOrderStatus, string> = {
    Draft: 'Draft',
    Prepped: 'Prepped',
    Collected: 'Collected',
    Returned: 'Returned',
    'Partial Return': 'Partial Return',
    Missing: 'Missing',
  };

  protected orderForm = this.fb.group({
    customerName: ['', Validators.required],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: [''],
    eventName: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    location: ['', Validators.required],
    deliveryMethod: ['pickup', Validators.required],
    notes: [''],
    recipients: ['operations@cue-rms.local'],
    items: this.fb.array([this.buildItemGroup()]),
  });

  protected returnSheets: Record<string, Record<number, number>> = {};

  ngOnInit(): void {
    this.refreshData();
  }

  protected get itemsArray(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  protected addItemRow(): void {
    this.itemsArray.push(this.buildItemGroup());
  }

  protected removeItemRow(index: number): void {
    if (this.itemsArray.length === 1) return;
    this.itemsArray.removeAt(index);
  }

  protected availableStock(item: PartyHireStockItem): number {
    return Math.max(0, item.total - item.allocated);
  }

  protected remainingStock(stockId: number | null | undefined): number {
    if (!stockId) return 0;
    const stock = this.inventory.find((item) => item.id === stockId);
    return stock ? this.availableStock(stock) : 0;
  }

  protected submitOrder(): void {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    const value = this.orderForm.getRawValue();
    const items = (value.items ?? []).map((item) => ({
      stockId: Number(item?.['stockId']),
      quantity: Number(item?.['quantity']),
    }));

    const recipients = this.parseRecipients(value.recipients ?? '');

    const order = this.partyHireService.createOrder({
      customerName: value.customerName ?? '',
      contactEmail: value.contactEmail ?? '',
      contactPhone: value.contactPhone ?? '',
      eventName: value.eventName ?? '',
      startDate: value.startDate ?? '',
      endDate: value.endDate ?? '',
      location: value.location ?? '',
      deliveryMethod: (value.deliveryMethod as 'pickup' | 'delivery') ?? 'pickup',
      notes: value.notes ?? '',
      recipients,
      items,
    });

    this.calendarMessage =
      'A Google Calendar invite template has been generated for the recipients. You can also resend it from the order card.';

    this.orderForm.reset({
      deliveryMethod: 'pickup',
      recipients: value.recipients,
      items: [],
    });
    this.itemsArray.push(this.buildItemGroup());

    this.refreshData();
    this.initialiseReturnSheet(order);
  }

  protected updateStatus(order: PartyHireOrder, status: PartyHireOrderStatus): void {
    this.partyHireService.updateStatus(order.id, status);
    this.refreshData();
  }

  protected applyReturnStatus(
    order: PartyHireOrder,
    status: Extract<PartyHireOrderStatus, 'Returned' | 'Partial Return'>,
  ): void {
    const returned = this.returnSheets[order.id] ?? {};
    this.partyHireService.recordReturn(order.id, returned, status);
    this.refreshData();
  }

  protected regenerateCalendar(order: PartyHireOrder): void {
    this.partyHireService.regenerateCalendar(order.id);
    this.refreshData();
    this.calendarMessage = 'A fresh calendar invite has been generated for this order.';
  }

  protected printOrder(order: PartyHireOrder): void {
    this.selectedPrintId = order.id;
    setTimeout(() => window.print(), 50);
  }

  protected trackByOrder(_index: number, order: PartyHireOrder): string {
    return order.id;
  }

  protected trackByStockItem(_index: number, item: PartyHireStockItem): number {
    return item.id;
  }

  protected trackByControl(index: number, control: AbstractControl): number {
    const value = control.value as { stockId?: number } | null;
    return value?.stockId ?? index;
  }

  protected statusClass(status: PartyHireOrderStatus): string {
    return status.toLowerCase().replaceAll(' ', '-');
  }

  protected totalAllocated(stockId: number): number {
    const stock = this.inventory.find((item) => item.id === stockId);
    return stock?.allocated ?? 0;
  }

  private refreshData(): void {
    this.inventory = this.partyHireService.listStock();
    this.orders = this.partyHireService.listOrders();
    for (const order of this.orders) {
      this.initialiseReturnSheet(order);
    }
  }

  private initialiseReturnSheet(order: PartyHireOrder): void {
    if (!this.returnSheets[order.id]) {
      this.returnSheets[order.id] = Object.fromEntries(
        order.items.map((item) => [item.stockId, order.returnedItems?.[item.stockId] ?? item.quantity]),
      );
    }
  }

  private buildItemGroup() {
    return this.fb.group({
      stockId: [this.inventory[0]?.id ?? null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });
  }

  private parseRecipients(raw: string): string[] {
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
}
