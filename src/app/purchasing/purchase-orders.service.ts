import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryItem } from '../shared/models-and-mappers/item/item-model';
import { PreferencesService } from '../shared/preferences/preferences.service';

export type PurchaseOrderStatus =
  | 'Ordered'
  | 'Shipping'
  | 'Shipped'
  | 'Received'
  | 'Cancelled';

export type FreightCarrier =
  | 'NZPost'
  | 'Mainfreight'
  | 'FedEx'
  | 'DHL'
  | 'Mainstream'
  | 'Team Global Express'
  | 'NZ Couriers'
  | 'Posthaste';

export interface PurchaseOrderItem {
  id: string;
  description: string;
  sku?: string;
  quantity: number;
  price: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendor: string;
  branch: string;
  deliveryContact: string;
  deliveryAddress: string;
  recipientBranch: string;
  status: PurchaseOrderStatus;
  trackingNumber?: string;
  carrier?: FreightCarrier;
  expectedArrival: string;
  createdOn: string;
  updatedOn: string;
  items: PurchaseOrderItem[];
}

export interface BranchDeliveryProfile {
  name: string;
  contact: string;
  address: string;
}

@Injectable({ providedIn: 'root' })
export class PurchaseOrdersService {
  private readonly branchProfiles: BranchDeliveryProfile[] = [
    {
      name: 'Christchurch',
      contact: 'Ops Desk · 03 555 0101',
      address: '61 Lichfield Street, Christchurch 8011',
    },
    {
      name: 'Dunedin',
      contact: 'Warehouse · 03 555 0145',
      address: '4 Wharf Street, Dunedin 9016',
    },
    {
      name: 'Auckland',
      contact: 'Freight Inwards · 09 555 0110',
      address: '120 Fanshawe Street, Auckland 1010',
    },
  ];

  private readonly ordersSubject = new BehaviorSubject<PurchaseOrder[]>([
    {
      id: 'po-001',
      poNumber: 'PO-2401',
      vendor: 'ACME Rigging Supplies',
      branch: 'Christchurch',
      recipientBranch: 'Christchurch',
      deliveryContact: 'Ops Desk · 03 555 0101',
      deliveryAddress: '61 Lichfield Street, Christchurch 8011',
      status: 'Shipping',
      carrier: 'Mainfreight',
      trackingNumber: 'MNF123456789',
      createdOn: '2024-08-18',
      updatedOn: '2024-08-19',
      expectedArrival: this.addDays('2024-08-18', 7),
      items: [
        {
          id: 'po-001-1',
          description: '12m Truss Length',
          sku: '564209',
          quantity: 12,
          price: 430,
        },
        {
          id: 'po-001-2',
          description: 'Chain Motor 1T',
          quantity: 8,
          price: 1250,
        },
      ],
    },
    {
      id: 'po-002',
      poNumber: 'PO-2402',
      vendor: 'Southern Audio Ltd',
      branch: 'Dunedin',
      recipientBranch: 'Dunedin',
      deliveryContact: 'Warehouse · 03 555 0145',
      deliveryAddress: '4 Wharf Street, Dunedin 9016',
      status: 'Received',
      carrier: 'NZPost',
      trackingNumber: 'NZP77881234',
      createdOn: '2024-08-01',
      updatedOn: '2024-08-07',
      expectedArrival: '2024-08-08',
      items: [
        {
          id: 'po-002-1',
          description: 'Shure SM58',
          sku: '843512',
          quantity: 24,
          price: 120,
        },
      ],
    },
    {
      id: 'po-003',
      poNumber: 'GRAV-PO-2403',
      vendor: 'Global Freight Partners',
      branch: 'Auckland',
      recipientBranch: 'Auckland',
      deliveryContact: 'Freight Inwards · 09 555 0110',
      deliveryAddress: '120 Fanshawe Street, Auckland 1010',
      status: 'Ordered',
      carrier: 'DHL',
      trackingNumber: 'DHL00997311',
      createdOn: '2024-08-20',
      updatedOn: '2024-08-20',
      expectedArrival: this.addDays('2024-08-20', 10),
      items: [
        {
          id: 'po-003-1',
          description: 'LED Fresnel 300W',
          sku: '192176',
          quantity: 20,
          price: 900,
        },
      ],
    },
  ]);

  readonly orders$ = this.ordersSubject.asObservable();

  constructor(
    private readonly inventoryService: InventoryService,
    private readonly preferencesService: PreferencesService,
  ) {}

  get orders(): PurchaseOrder[] {
    return this.ordersSubject.getValue();
  }

  get activeOrders(): PurchaseOrder[] {
    return this.orders.filter((order) => !this.isArchived(order));
  }

  get archivedOrders(): PurchaseOrder[] {
    return this.orders.filter((order) => this.isArchived(order));
  }

  getBranches(): BranchDeliveryProfile[] {
    return this.branchProfiles;
  }

  findBranchProfile(branch: string): BranchDeliveryProfile {
    return (
      this.branchProfiles.find((profile) => profile.name === branch) ||
      this.branchProfiles[0]
    );
  }

  findInventoryMatches(term: string): InventoryItem[] {
    const normalised = term.trim().toLowerCase();
    if (!normalised) return [];

    return this.inventoryService
      .list()
      .filter((item) =>
        [item.name, item.sku].some((field) =>
          field.toLowerCase().includes(normalised),
        ),
      )
      .slice(0, 5);
  }

  createOrder(payload: {
    vendor: string;
    branch: string;
    recipientBranch: string;
    deliveryContact: string;
    deliveryAddress: string;
    expectedArrival: string;
    status: PurchaseOrderStatus;
    trackingNumber?: string;
    carrier?: FreightCarrier;
    items: PurchaseOrderItem[];
  }): PurchaseOrder {
    const createdOn = new Date().toISOString().slice(0, 10);
    const poNumber = this.generatePoNumber();
    const order: PurchaseOrder = {
      id: crypto.randomUUID(),
      poNumber,
      vendor: payload.vendor || 'Unspecified vendor',
      branch: payload.branch,
      recipientBranch: payload.recipientBranch,
      deliveryContact: payload.deliveryContact,
      deliveryAddress: payload.deliveryAddress,
      status: payload.status,
      trackingNumber: payload.trackingNumber,
      carrier: payload.carrier,
      createdOn,
      updatedOn: createdOn,
      expectedArrival: payload.expectedArrival,
      items: payload.items.map((item) => ({
        ...item,
        id: item.id || crypto.randomUUID(),
      })),
    };

    this.ordersSubject.next([order, ...this.orders]);
    return order;
  }

  updateOrderStatus(id: string, status: PurchaseOrderStatus) {
    this.updateOrder(id, { status });
  }

  updateOrder(
    id: string,
    changes: Partial<Omit<PurchaseOrder, 'id' | 'poNumber'>>, // PO number is immutable once created
  ): void {
    const updatedOn = new Date().toISOString().slice(0, 10);

    const updated = this.orders.map((order) => {
      if (order.id !== id) return order;

      const items = changes.items
        ? changes.items.map((item) => ({
            ...item,
            id: item.id || crypto.randomUUID(),
          }))
        : order.items;

      return {
        ...order,
        ...changes,
        items,
        updatedOn,
      } satisfies PurchaseOrder;
    });

    this.ordersSubject.next(updated);
  }

  async exportDocumentPdf(
    order: PurchaseOrder,
    type: 'rfq' | 'po' | 'delivery',
    branding?: { name?: string; logoUrl?: string | null },
  ): Promise<void> {
    const JsPdf = await this.loadJsPdf();
    if (!JsPdf) throw new Error('Unable to load PDF generator');

    const doc = new JsPdf();
    const titleMap = {
      rfq: 'Request for Quotation',
      po: 'Purchase Order',
      delivery: 'Delivery Docket',
    } as const;

    let cursorY = 20;
    const logoData = await this.getLogoDataUrl(branding?.logoUrl);

    if (logoData) {
      doc.addImage(logoData, 'PNG', 14, 10, 40, 20);
      cursorY = 40;
    }

    doc.setFontSize(16);
    doc.text(titleMap[type], 14, cursorY);
    doc.setFontSize(11);
    doc.text(`PO Number: ${order.poNumber}`, 14, (cursorY += 8));
    doc.text(
      `Company: ${branding?.name ?? 'Company Name'}`,
      200,
      cursorY,
      { align: 'right' },
    );
    doc.text(`Vendor: ${order.vendor}`, 14, (cursorY += 8));
    doc.text(`Status: ${order.status}`, 14, (cursorY += 8));
    doc.text(`Tracking: ${order.carrier ?? 'TBC'} · ${order.trackingNumber ?? 'None'}`, 14, (cursorY += 8));
    doc.text(`Expected arrival: ${order.expectedArrival}`, 14, (cursorY += 8));
    doc.text(`Created: ${order.createdOn} · Last updated: ${order.updatedOn}`, 14, (cursorY += 8));
    doc.text('Ship to:', 14, (cursorY += 12));
    const addressLines = doc.splitTextToSize(
      `${order.recipientBranch} — ${order.deliveryContact}\n${order.deliveryAddress}`,
      180,
    );
    doc.text(addressLines, 14, cursorY + 6);
    cursorY += 18;

    doc.setFontSize(12);
    doc.text('Items', 14, cursorY);
    doc.setLineWidth(0.4);
    doc.line(14, cursorY + 2, 196, cursorY + 2);
    cursorY += 8;
    doc.setFontSize(11);

    order.items.forEach((item, index) => {
      const line = `${index + 1}. ${item.description} (${item.sku ?? 'SKU not set'}) ×${item.quantity} @ $${item.price.toFixed(2)} = $${(item.quantity * item.price).toFixed(2)}`;
      const wrapped = doc.splitTextToSize(line, 180);
      doc.text(wrapped, 14, cursorY);
      cursorY += wrapped.length * 6 + 2;
    });

    doc.setFontSize(12);
    doc.text(
      `Total: $${this.calculateTotal(order).toFixed(2)}`,
      196,
      cursorY + 6,
      { align: 'right' },
    );

    doc.save(`${order.poNumber}-${type}.pdf`);
  }

  calculateTotal(order: PurchaseOrder): number {
    return order.items.reduce(
      (sum, item) => sum + item.quantity * item.price,
      0,
    );
  }

  isArchived(order: PurchaseOrder): boolean {
    return order.status === 'Received' || order.status === 'Cancelled';
  }

  private addDays(date: string, days: number): string {
    const base = new Date(date);
    base.setDate(base.getDate() + days);
    return base.toISOString().slice(0, 10);
  }

  private generatePoNumber(): string {
    const prefix = this.preferencesService.getPurchaseOrderPrefix();
    const numericValues = this.orders
      .map((order) => Number(order.poNumber.replace(/\D+/g, '')))
      .filter((num) => !Number.isNaN(num));
    const nextNumber = numericValues.length
      ? Math.max(...numericValues) + 1
      : 2400;
    return `${prefix}${nextNumber}`;
  }

  private jsPdfLoader?: Promise<any>;

  private loadJsPdf(): Promise<any> {
    if (!this.jsPdfLoader) {
      this.jsPdfLoader = new Promise((resolve) => {
        const existing = (window as any).jspdf?.jsPDF;
        if (existing) {
          resolve(existing);
          return;
        }

        const script = document.createElement('script');
        script.src =
          'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.async = true;
        script.onload = () => resolve((window as any).jspdf?.jsPDF ?? null);
        script.onerror = () => resolve(null);
        document.body.appendChild(script);
      });
    }

    return this.jsPdfLoader;
  }

  private async getLogoDataUrl(logoUrl?: string | null): Promise<string | null> {
    if (!logoUrl) return null;

    try {
      const response = await fetch(logoUrl);
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn('Unable to fetch logo for PDF export', err);
      return null;
    }
  }
}
