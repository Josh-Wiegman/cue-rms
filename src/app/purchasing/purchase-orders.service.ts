/* eslint-disable @typescript-eslint/no-explicit-any */
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
    const updated = this.orders.map((order) =>
      order.id === id ? { ...order, status } : order,
    );
    this.ordersSubject.next(updated);
  }

  exportDocument(
    order: PurchaseOrder,
    type: 'rfq' | 'po' | 'delivery',
  ): string {
    const titleMap = {
      rfq: 'Request for Quotation',
      po: 'Purchase Order',
      delivery: 'Delivery Docket',
    } as const;

    const items = order.items
      .map(
        (item) =>
          `- ${item.description} (${item.sku ?? 'no sku'}) ×${item.quantity} @ $${item.price.toFixed(2)}`,
      )
      .join('\n');

    return `${titleMap[type]}\nPO: ${order.poNumber}\nVendor: ${order.vendor}\nShip to: ${order.deliveryAddress}\nStatus: ${order.status}\nExpected: ${order.expectedArrival}\nItems:\n${items}\nTotal: $${this.calculateTotal(order).toFixed(2)}`;
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
}
