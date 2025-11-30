import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  Discount,
  SalesOrderSummary,
  SalesOrdersService,
  StockGroup,
  StockItem,
} from '../sales-orders.service';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';

interface PickerState {
  search: string;
  isOpen: boolean;
}

@Component({
  selector: 'sales-order-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    CurrencyPipe,
    DatePipe,
    UiShellComponent,
  ],
  templateUrl: './sales-order-detail.component.html',
  styleUrl: './sales-order-detail.component.scss',
})
export class SalesOrderDetailComponent implements OnInit, OnDestroy {
  order?: SalesOrderSummary;
  pickerState: Record<string, PickerState> = {};
  availableItems: StockItem[] = [
    {
      id: 'lib-1',
      name: 'Wireless Microphone Kit',
      sku: 'AUD-220',
      quantity: 1,
      rates: { oneDay: 45, threeDay: 120, week: 180 },
    },
    {
      id: 'lib-2',
      name: 'Moving Head Spot',
      sku: 'LGT-501',
      quantity: 1,
      rates: { oneDay: 75, threeDay: 195, week: 280 },
    },
    {
      id: 'lib-3',
      name: 'Stage Deck 1m x 2m',
      sku: 'STG-102',
      quantity: 1,
      rates: { oneDay: 30, threeDay: 80, week: 120 },
    },
    {
      id: 'lib-4',
      name: 'Power Cable 10m',
      sku: 'CAB-010',
      quantity: 1,
      rates: { oneDay: 5, threeDay: 12, week: 18 },
    },
    {
      id: 'lib-5',
      name: 'Video Switcher',
      sku: 'VID-303',
      quantity: 1,
      rates: { oneDay: 180, threeDay: 470, week: 680 },
    },
    {
      id: 'lib-6',
      name: 'Lighting Console',
      sku: 'LGT-900',
      quantity: 1,
      rates: { oneDay: 140, threeDay: 360, week: 520 },
    },
  ];

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly salesOrdersService: SalesOrdersService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.route.paramMap.subscribe((params) => {
        const orderNumber = params.get('orderNumber');
        if (!orderNumber) {
          return;
        }
        const order = this.salesOrdersService.getOrderByNumber(orderNumber);
        if (!order) {
          this.router.navigate(['/sales']);
          return;
        }
        this.order = JSON.parse(JSON.stringify(order));
        if (this.order && !this.order.globalDiscount) {
          this.order.globalDiscount = { type: 'percent', value: 0 };
        }
        if (this.order?.groups) {
          this.seedPickerState(this.order.groups);
        }
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  private seedPickerState(groups: StockGroup[]) {
    groups.forEach((group) => {
      this.pickerState[group.id] = { search: '', isOpen: false };
      if (group.groups.length) {
        this.seedPickerState(group.groups);
      }
    });
  }

  togglePicker(groupId: string) {
    const state = this.pickerState[groupId];
    this.pickerState[groupId] = {
      ...(state || { search: '' }),
      isOpen: !state?.isOpen,
    };
  }

  filteredLibrary(groupId: string): StockItem[] {
    const state = this.pickerState[groupId];
    const term = state?.search?.toLowerCase() ?? '';
    return this.availableItems
      .filter((item) =>
        term
          ? [item.name, item.sku].join(' ').toLowerCase().includes(term)
          : true,
      )
      .slice(0, 30);
  }

  onSearchChange(groupId: string, value: string) {
    this.pickerState[groupId] = {
      ...(this.pickerState[groupId] || { isOpen: true }),
      search: value,
    };
  }

  addItem(groupId: string, libraryItem: StockItem) {
    if (!this.order) return;
    const clone: StockItem = {
      ...libraryItem,
      id: `${libraryItem.id}-${crypto.randomUUID()}`,
    };
    this.applyToGroup(this.order.groups, groupId, (group) => {
      group.items = [...group.items, clone];
    });
  }

  addGroup(parentId?: string) {
    if (!this.order) return;
    const newGroup: StockGroup = {
      id: `grp-${crypto.randomUUID()}`,
      title: 'New Group',
      items: [],
      groups: [],
    };

    if (!parentId) {
      this.order.groups = [...this.order.groups, newGroup];
      this.pickerState[newGroup.id] = { search: '', isOpen: false };
      return;
    }

    this.applyToGroup(this.order.groups, parentId, (group) => {
      group.groups = [...group.groups, newGroup];
      this.pickerState[newGroup.id] = { search: '', isOpen: false };
    });
  }

  private applyToGroup(
    groups: StockGroup[],
    targetId: string,
    mutate: (group: StockGroup) => void,
  ) {
    for (const group of groups) {
      if (group.id === targetId) {
        mutate(group);
        return;
      }
      if (group.groups?.length) {
        this.applyToGroup(group.groups, targetId, mutate);
      }
    }
  }

  updateBillableDays(value: number) {
    if (!this.order) return;
    this.order.billableDays = Number(value) || 1;
  }

  setItemDiscountType(item: StockItem, discountType: Discount['type'] | '') {
    if (!discountType) {
      item.discount = undefined;
      return;
    }
    item.discount = item.discount ?? { type: discountType, value: 0 };
    item.discount.type = discountType;
  }

  updateItemDiscountValue(item: StockItem, value: number) {
    if (!item.discount) {
      item.discount = { type: 'percent', value };
      return;
    }
    item.discount.value = value;
  }

  updateOrder() {
    if (!this.order) return;
    this.salesOrdersService.updateOrder(this.order);
  }

  itemPrice(item: StockItem, billableDays: number): number {
    const oneDayPrice = item.rates.oneDay * billableDays;
    const threeDayPrice = item.rates.threeDay ?? oneDayPrice;
    const weekPrice = item.rates.week ?? Math.min(oneDayPrice, threeDayPrice);
    const base = Math.min(oneDayPrice, threeDayPrice, weekPrice);

    if (!item.discount) return base * item.quantity;
    return (
      base * item.quantity -
      this.calculateDiscount(base * item.quantity, item.discount)
    );
  }

  private calculateDiscount(amount: number, discount: Discount): number {
    if (discount.type === 'percent') {
      return (amount * discount.value) / 100;
    }
    return discount.value;
  }

  get subtotal(): number {
    if (!this.order) return 0;
    return this.order.groups
      .flatMap((group) => this.collectItems(group))
      .reduce(
        (sum, item) => sum + this.itemPrice(item, this.order!.billableDays),
        0,
      );
  }

  private collectItems(group: StockGroup): StockItem[] {
    const items = [...group.items];
    group.groups.forEach((child) => items.push(...this.collectItems(child)));
    return items;
  }

  get totalDiscountValue(): number {
    if (!this.order?.globalDiscount) return 0;
    return this.calculateDiscount(this.subtotal, this.order.globalDiscount);
  }

  get totalExcl(): number {
    return Math.max(this.subtotal - this.totalDiscountValue, 0);
  }

  get totalIncl(): number {
    return this.totalExcl * 1.15;
  }
}
