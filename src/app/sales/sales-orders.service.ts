import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

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
}
