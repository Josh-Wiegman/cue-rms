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
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
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
  protected groupedOrders: {
    date: string;
    label: string;
    orders: PartyHireOrder[];
  }[] = [];
  protected showOrderModal = false;
  protected activeOrder: PartyHireOrder | null = null;
  protected calendarMessage = '';
  protected loading = false;
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
    void this.refreshData();
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

  protected filteredInventory(index: number): PartyHireStockItem[] {
    const searchTerm =
      (this.itemsArray.at(index).get('searchTerm')?.value as string) ?? '';

    if (!searchTerm.trim()) return this.inventory;

    const term = searchTerm.toLowerCase();
    return this.inventory.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        item.category.toLowerCase().includes(term),
    );
  }

  protected selectStock(index: number, stock: PartyHireStockItem): void {
    const group = this.itemsArray.at(index);
    group.get('stockId')?.setValue(stock.id);
    group.get('searchTerm')?.setValue(stock.name);
  }

  protected async submitOrder(): Promise<void> {
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

    const order = await this.partyHireService.createOrder({
      customerName: value.customerName ?? '',
      contactEmail: value.contactEmail ?? '',
      contactPhone: value.contactPhone ?? '',
      eventName: value.eventName ?? '',
      startDate: value.startDate ?? '',
      endDate: value.endDate ?? '',
      location: value.location ?? '',
      deliveryMethod:
        (value.deliveryMethod as 'pickup' | 'delivery') ?? 'pickup',
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

    this.showOrderModal = false;

    await this.refreshData();
    this.initialiseReturnSheet(order);
  }

  protected openOrderModal(): void {
    this.showOrderModal = true;
  }

  protected closeOrderModal(): void {
    this.showOrderModal = false;
    this.orderForm.reset({
      deliveryMethod: 'pickup',
      recipients: this.orderForm.value.recipients,
      items: [],
    });
    this.itemsArray.clear();
    this.itemsArray.push(this.buildItemGroup());
  }

  protected async updateStatus(
    order: PartyHireOrder,
    status: PartyHireOrderStatus,
  ): Promise<void> {
    await this.partyHireService.updateStatus(order.id, status);
    await this.refreshData();
  }

  protected async applyReturnStatus(
    order: PartyHireOrder,
    status: Extract<PartyHireOrderStatus, 'Returned' | 'Partial Return'>,
  ): Promise<void> {
    const returned = this.returnSheets[order.id] ?? {};
    await this.partyHireService.recordReturn(order.id, returned, status);
    await this.refreshData();
  }

  protected async regenerateCalendar(order: PartyHireOrder): Promise<void> {
    await this.partyHireService.regenerateCalendar(order.id);
    await this.refreshData();
    this.calendarMessage =
      'A fresh calendar invite has been generated for this order.';
  }

  protected printSalesOrder(order: PartyHireOrder): void {
    const documentBody = this.buildSalesOrderTemplate(order);
    this.openPrintWindow(`Sales Order ${order.reference}`, documentBody);
  }

  protected printPickList(order: PartyHireOrder): void {
    const documentBody = this.buildPickListTemplate(order);
    this.openPrintWindow(`Pick List ${order.reference}`, documentBody);
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

  private async refreshData(): Promise<void> {
    this.loading = true;
    const [inventory, orders] = await Promise.all([
      this.partyHireService.listStock(),
      this.partyHireService.listOrders(),
    ]);
    this.inventory = inventory;
    this.orders = orders.sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
    this.groupedOrders = this.buildGroupedOrders();
    this.orders.forEach((order) => this.initialiseReturnSheet(order));
    this.loading = false;
  }

  private initialiseReturnSheet(order: PartyHireOrder): void {
    if (!this.returnSheets[order.id]) {
      this.returnSheets[order.id] = Object.fromEntries(
        order.items.map((item) => [
          item.stockId,
          order.returnedItems?.[item.stockId] ?? item.quantity,
        ]),
      );
    }
  }

  private buildItemGroup() {
    return this.fb.group({
      searchTerm: [''],
      stockId: [null, Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
    });
  }

  private parseRecipients(raw: string): string[] {
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private buildGroupedOrders(): {
    date: string;
    label: string;
    orders: PartyHireOrder[];
  }[] {
    const dateMap = new Map<string, PartyHireOrder[]>();

    this.orders.forEach((order) => {
      const dateKey = new Date(order.startDate).toDateString();
      const group = dateMap.get(dateKey) ?? [];
      group.push(order);
      dateMap.set(dateKey, group);
    });

    const sortedKeys = Array.from(dateMap.keys()).sort((a, b) => {
      const dateA = new Date(a).setHours(0, 0, 0, 0);
      const dateB = new Date(b).setHours(0, 0, 0, 0);
      return dateA - dateB;
    });

    const todayKey = new Date().toDateString();
    const orderedKeys = [
      ...sortedKeys.filter((key) => key === todayKey),
      ...sortedKeys.filter((key) => key !== todayKey),
    ];

    return orderedKeys.map((key) => {
      const date = new Date(key);
      const label =
        key === todayKey
          ? 'Today'
          : new Intl.DateTimeFormat('en-NZ', {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            }).format(date);

      return {
        date: key,
        label,
        orders: (dateMap.get(key) ?? []).sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
        ),
      };
    });
  }

  protected openOrderDetail(order: PartyHireOrder): void {
    this.activeOrder = order;
    this.initialiseReturnSheet(order);
  }

  protected closeOrderDetail(): void {
    this.activeOrder = null;
  }

  private openPrintWindow(title: string, body: string): void {
    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) return;

    printWindow.document.write(`<!doctype html><html><head><title>${title}</title>
      <style>
        body { font-family: 'Inter', system-ui, -apple-system, sans-serif; margin: 0; padding: 1.5rem; color: #0f172a; }
        h1, h2, h3, h4 { margin: 0 0 0.35rem 0; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 0.75rem; margin-bottom: 1rem; }
        .pill { display: inline-flex; padding: 0.25rem 0.75rem; border-radius: 999px; background: #0ea5e9; color: #0b1726; font-weight: 600; }
        .meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 0.5rem; margin-bottom: 1rem; }
        .meta strong { display: block; color: #0f172a; margin-bottom: 0.15rem; }
        table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
        th, td { text-align: left; padding: 0.55rem; border-bottom: 1px solid #e2e8f0; }
        th { background: #0f172a; color: #e2e8f0; }
        .total-row { font-weight: 700; }
        .accent { color: #0ea5e9; }
      </style>
    </head><body>${body}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 200);
  }

  private buildSalesOrderTemplate(order: PartyHireOrder): string {
    const items = order.items
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${item.unitPrice.toFixed(2)}</td>
            <td>${(item.quantity * item.unitPrice).toFixed(2)}</td>
          </tr>`,
      )
      .join('');

    return `
      <div class="header">
        <div>
          <p class="pill">${order.status}</p>
          <h1>Sales order ${order.reference}</h1>
          <p class="accent">Quote ${order.quoteNumber} • Invoice ${order.invoiceNumber}</p>
        </div>
        <div>
          <strong>${order.eventName}</strong><br />
          ${new Date(order.startDate).toLocaleString()} - ${new Date(
            order.endDate,
          ).toLocaleString()}
        </div>
      </div>
      <div class="meta">
        <div><strong>Customer</strong>${order.customerName}</div>
        <div><strong>Contact</strong>${order.contactEmail} • ${order.contactPhone}</div>
        <div><strong>Location</strong>${order.location}</div>
        <div><strong>Delivery</strong>${order.deliveryMethod}</div>
        <div><strong>Notes</strong>${order.notes || '—'}</div>
      </div>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr>
        </thead>
        <tbody>${items}</tbody>
        <tfoot>
          <tr class="total-row"><td colspan="3">Subtotal</td><td>${order.totals.subtotal.toFixed(2)}</td></tr>
          <tr class="total-row"><td colspan="3">GST (15%)</td><td>${order.totals.gst.toFixed(2)}</td></tr>
          <tr class="total-row"><td colspan="3">Total</td><td>${order.totals.total.toFixed(2)}</td></tr>
        </tfoot>
      </table>
    `;
  }

  private buildPickListTemplate(order: PartyHireOrder): string {
    const items = order.items
      .map(
        (item) => `
          <tr>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${item.unitPrice.toFixed(2)}</td>
            <td>${(item.quantity * item.unitPrice).toFixed(2)}</td>
          </tr>`,
      )
      .join('');

    return `
      <div class="header">
        <div>
          <p class="pill">Pick list</p>
          <h1>${order.eventName}</h1>
          <p class="accent">${order.reference} • ${order.customerName}</p>
        </div>
        <div>
          <strong>Pack by</strong><br />${new Date(order.startDate).toLocaleString()}
        </div>
      </div>
      <div class="meta">
        <div><strong>Location</strong>${order.location}</div>
        <div><strong>Delivery</strong>${order.deliveryMethod}</div>
        <div><strong>Contact</strong>${order.contactEmail} • ${order.contactPhone}</div>
      </div>
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Line total</th></tr>
        </thead>
        <tbody>${items}</tbody>
      </table>
    `;
  }
}
