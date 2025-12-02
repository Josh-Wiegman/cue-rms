import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InventoryService } from '../inventory/inventory.service';
import { InventoryItem } from '../shared/models-and-mappers/item/item-model';

export type OrderStatus =
  | 'Quote'
  | 'Confirmed'
  | 'Invoiced'
  | 'Completed'
  | 'Dead';

export type WarehouseStatus =
  | 'To Prep'
  | 'Prepped'
  | 'Loaded'
  | 'With Client'
  | 'Returned'
  | 'Partial Return'
  | 'Completed';

export type OrderType = 'Production' | 'Dry Hire' | 'Stock Transfer';

export interface Discount {
  type: 'percent' | 'amount';
  value: number;
}

export interface StockItem {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  billableDays?: number;
  rates: {
    oneDay: number;
    threeDay?: number;
    week?: number;
  };
  discount?: Discount;
}

export interface StockGroup {
  id: string;
  title: string;
  items: StockItem[];
  groups: StockGroup[];
}

export interface SalesOrderSummary {
  id: string;
  orderNumber: string;
  title: string;
  accountManager: string;
  startDate: string;
  endDate: string;
  branch: string;
  customer: string;
  deliveryLocation: string;
  serviceBranch: string;
  status: OrderStatus;
  warehouseStatus: WarehouseStatus;
  internalReference: string;
  customerReference: string;
  totalDiscount: number;
  billableDays: number;
  rentalPeriodDays: number;
  tags: string[];
  orderType: OrderType;
  globalDiscount?: Discount;
  groups: StockGroup[];
}

@Injectable({ providedIn: 'root' })
export class SalesOrdersService {
  private readonly ordersSubject = new BehaviorSubject<SalesOrderSummary[]>([
    {
      id: 'so-1001',
      orderNumber: 'SO-1001',
      title: 'Corporate Gala AV',
      accountManager: 'Jessie McCarthy',
      startDate: '2024-08-12',
      endDate: '2024-08-15',
      branch: 'Christchurch',
      customer: 'Canterbury Insurance Group',
      deliveryLocation: 'Te Pae Convention Centre',
      serviceBranch: 'Christchurch',
      status: 'Confirmed',
      warehouseStatus: 'Prepped',
      internalReference: 'SO-1001',
      customerReference: 'PO-88394',
      totalDiscount: 150,
      billableDays: 3,
      rentalPeriodDays: 4,
      orderType: 'Production',
      tags: ['AV', 'Gala'],
      globalDiscount: { type: 'amount', value: 300 },
      groups: [
        {
          id: 'grp-stage',
          title: 'Stage Package',
          items: [
            {
              id: 'itm-1',
              name: 'LED Wash Light',
              sku: 'LGT-203',
              quantity: 12,
              rates: { oneDay: 65, threeDay: 170, week: 240 },
              discount: { type: 'percent', value: 5 },
            },
            {
              id: 'itm-2',
              name: 'Power Distro 32A',
              sku: 'PWR-009',
              quantity: 2,
              rates: { oneDay: 120, threeDay: 300, week: 420 },
            },
          ],
          groups: [
            {
              id: 'grp-rigging',
              title: 'Rigging',
              items: [
                {
                  id: 'itm-3',
                  name: 'Truss 3m',
                  sku: 'TRS-300',
                  quantity: 6,
                  rates: { oneDay: 40, threeDay: 100, week: 145 },
                  discount: { type: 'amount', value: 30 },
                },
              ],
              groups: [],
            },
          ],
        },
      ],
    },
    {
      id: 'so-1002',
      orderNumber: 'SO-1002',
      title: 'Outdoor Concert PA',
      accountManager: 'Teuila Morgan',
      startDate: '2024-09-02',
      endDate: '2024-09-07',
      branch: 'Dunedin',
      customer: 'Southern Summer Events',
      deliveryLocation: 'Forsyth Barr Stadium',
      serviceBranch: 'Dunedin',
      status: 'Quote',
      warehouseStatus: 'To Prep',
      internalReference: 'SO-1002',
      customerReference: 'PO-99231',
      totalDiscount: 0,
      billableDays: 5,
      rentalPeriodDays: 6,
      orderType: 'Dry Hire',
      tags: ['Audio'],
      groups: [
        {
          id: 'grp-pa',
          title: 'PA System',
          items: [
            {
              id: 'itm-4',
              name: 'Line Array Element',
              sku: 'AUD-401',
              quantity: 16,
              rates: { oneDay: 85, threeDay: 210, week: 320 },
            },
          ],
          groups: [],
        },
      ],
    },
  ]);

  readonly orders$ = this.ordersSubject.asObservable();

  constructor(private readonly inventoryService: InventoryService) {}

  get orders(): SalesOrderSummary[] {
    return this.ordersSubject.getValue();
  }

  getOrderByNumber(orderNumber: string): SalesOrderSummary | undefined {
    return this.orders.find((order) => order.orderNumber === orderNumber);
  }

  updateOrder(updated: SalesOrderSummary) {
    const orders = this.orders.map((order) =>
      order.id === updated.id ? updated : order,
    );
    this.ordersSubject.next(orders);
  }

  createOrder(payload: Partial<SalesOrderSummary>): SalesOrderSummary {
    const nextNumber = this.generateOrderNumber();
    const order: SalesOrderSummary = {
      id: crypto.randomUUID(),
      orderNumber: nextNumber,
      internalReference: nextNumber,
      accountManager: payload.accountManager || 'Unassigned',
      title: payload.title || 'New Sales Order',
      startDate: payload.startDate || new Date().toISOString().slice(0, 10),
      endDate: payload.endDate || payload.startDate || new Date().toISOString().slice(0, 10),
      branch: payload.branch || 'Christchurch',
      customer: payload.customer || 'Walk-up customer',
      deliveryLocation: payload.deliveryLocation || 'TBC',
      serviceBranch: payload.serviceBranch || payload.branch || 'Christchurch',
      status: payload.status || 'Quote',
      warehouseStatus: payload.warehouseStatus || 'To Prep',
      customerReference: payload.customerReference || '',
      totalDiscount: payload.totalDiscount ?? 0,
      billableDays: payload.billableDays || 1,
      rentalPeriodDays: payload.rentalPeriodDays || 1,
      orderType: payload.orderType || 'Dry Hire',
      tags: payload.tags || [],
      groups: payload.groups || [],
      globalDiscount: payload.globalDiscount,
    };

    this.ordersSubject.next([order, ...this.orders]);
    return order;
  }

  getStockLibrary(): StockItem[] {
    return this.inventoryService.list().map((item) => this.mapInventory(item));
  }

  private mapInventory(item: InventoryItem): StockItem {
    return {
      id: `inv-${item.id}`,
      name: item.name,
      sku: item.sku,
      quantity: 1,
      rates: {
        oneDay: item.pricing.oneDay,
        threeDay: item.pricing.threeDay,
        week: item.pricing.week,
      },
    };
  }

  private generateOrderNumber(): string {
    const numbers = this.orders
      .map((order) => Number(order.orderNumber.replace(/\D+/g, '')))
      .filter((num) => !Number.isNaN(num));
    const next = numbers.length ? Math.max(...numbers) + 1 : 1000;
    return `SO-${next}`;
  }
}
