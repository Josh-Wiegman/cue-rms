import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
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

interface PickerSelection {
  item: StockItem;
  quantity: number;
}

type EditSection = 'schedule' | 'customer' | 'financial' | null;

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
  availableItems: StockItem[] = [];
  activeEdit: EditSection = null;
  pickerModal = {
    open: false,
    groupId: null as string | null,
    search: '',
    selections: {} as Record<string, PickerSelection>,
  };
  draftSchedule = {
    startDate: '',
    endDate: '',
    billableDays: 1,
    rentalPeriodDays: 1,
  };
  draftCustomer = {
    customer: '',
    deliveryLocation: '',
    serviceBranch: '',
    status: 'Quote' as SalesOrderSummary['status'],
    warehouseStatus: 'To Prep' as SalesOrderSummary['warehouseStatus'],
    orderType: 'Dry Hire' as SalesOrderSummary['orderType'],
    tags: '' as string,
  };
  draftFinancial: {
    discount?: Discount;
    customerReference: string;
    totalDiscount: number;
  } = {
    discount: { type: 'percent', value: 0 },
    customerReference: '',
    totalDiscount: 0,
  };
  draggedItem: { groupId: string; itemId: string } | null = null;

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
        this.availableItems = this.salesOrdersService.getStockLibrary();
        if (this.order && !this.order.globalDiscount) {
          this.order.globalDiscount = { type: 'percent', value: 0 };
        }
      }),
    );
  }

  ngOnDestroy(): void {
    if (this.order) {
      this.updateOrder();
    }
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  @HostListener('window:beforeunload')
  handleBeforeUnload() {
    if (this.order) {
      this.updateOrder();
    }
  }

  openPicker(groupId: string) {
    this.pickerModal = {
      open: true,
      groupId,
      search: '',
      selections: {},
    };
  }

  closePicker() {
    this.pickerModal = {
      open: false,
      groupId: null,
      search: '',
      selections: {},
    };
  }

  filteredLibrary(): StockItem[] {
    const term = this.pickerModal.search.toLowerCase();
    return this.availableItems
      .filter((item) =>
        term
          ? [item.name, item.sku].join(' ').toLowerCase().includes(term)
          : true,
      )
      .slice(0, 30);
  }

  toggleSelection(libraryItem: StockItem) {
    const selections = { ...this.pickerModal.selections };
    if (selections[libraryItem.id]) {
      delete selections[libraryItem.id];
    } else {
      selections[libraryItem.id] = { item: libraryItem, quantity: 1 };
    }
    this.pickerModal = { ...this.pickerModal, selections };
  }

  updateSelectionQuantity(itemId: string, value: number) {
    const selections = { ...this.pickerModal.selections };
    if (!selections[itemId]) return;
    const quantity = Math.max(1, Number(value) || 1);
    selections[itemId] = { ...selections[itemId], quantity };
    this.pickerModal = { ...this.pickerModal, selections };
  }

  isSelected(itemId: string): boolean {
    return Boolean(this.pickerModal.selections[itemId]);
  }

  get pickerSelections(): PickerSelection[] {
    return Object.values(this.pickerModal.selections);
  }

  confirmPicker() {
    if (!this.order || !this.pickerModal.groupId) return;
    const selections = this.pickerSelections;
    if (!selections.length) {
      this.closePicker();
      return;
    }

    this.applyToGroup(this.order.groups, this.pickerModal.groupId, (group) => {
      const additions = selections.map((selection) => ({
        ...selection.item,
        quantity: selection.quantity,
        id: `${selection.item.id}-${crypto.randomUUID()}`,
      }));
      group.items = [...group.items, ...additions];
    });

    this.closePicker();
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
      return;
    }

    this.applyToGroup(this.order.groups, parentId, (group) => {
      group.groups = [...group.groups, newGroup];
    });
  }

  removeItem(groupId: string, itemId: string) {
    if (!this.order) return;
    this.applyToGroup(this.order.groups, groupId, (group) => {
      group.items = group.items.filter((item) => item.id !== itemId);
    });
  }

  removeGroup(groupId: string) {
    if (!this.order) return;
    this.order.groups = this.pruneGroup(this.order.groups, groupId);
  }

  startDrag(groupId: string, itemId: string) {
    this.draggedItem = { groupId, itemId };
  }

  endDrag() {
    this.draggedItem = null;
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
  }

  onDrop(event: DragEvent, targetGroupId: string, targetIndex?: number) {
    event.preventDefault();
    event.stopPropagation();

    if (!this.order || !this.draggedItem) return;

    const { groupId: sourceGroupId, itemId } = this.draggedItem;
    let removedIndex: number | null = null;
    let movingItem: StockItem | undefined;

    this.applyToGroup(this.order.groups, sourceGroupId, (group) => {
      const idx = group.items.findIndex((item) => item.id === itemId);
      if (idx !== -1) {
        removedIndex = idx;
        [movingItem] = group.items.splice(idx, 1);
      }
    });

    if (!movingItem) {
      this.draggedItem = null;
      return;
    }

    let inserted = false;

    this.applyToGroup(this.order.groups, targetGroupId, (group) => {
      let insertAt =
        typeof targetIndex === 'number' ? targetIndex : group.items.length;

      if (
        sourceGroupId === targetGroupId &&
        removedIndex !== null &&
        removedIndex < insertAt
      ) {
        insertAt -= 1;
      }

      insertAt = Math.max(0, Math.min(insertAt, group.items.length));
      group.items.splice(insertAt, 0, movingItem!);
      inserted = true;
    });

    if (!inserted) {
      this.applyToGroup(this.order.groups, sourceGroupId, (group) => {
        group.items.splice(removedIndex ?? group.items.length, 0, movingItem!);
      });
    }

    this.draggedItem = null;
  }

  isDraggingItem(itemId: string): boolean {
    return this.draggedItem?.itemId === itemId;
  }

  private pruneGroup(groups: StockGroup[], targetId: string): StockGroup[] {
    return groups
      .filter((group) => group.id !== targetId)
      .map((group) => ({
        ...group,
        groups: this.pruneGroup(group.groups, targetId),
      }));
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

  updateItemQuantity(item: StockItem, value: number) {
    item.quantity = Math.max(1, Number(value) || 1);
  }

  updateItemBillableDays(item: StockItem, value: number | null | string) {
    if (value === '' || value === null) {
      item.billableDays = undefined;
      return;
    }
    const parsed = Number(value);
    item.billableDays = parsed > 0 ? parsed : undefined;
  }

  updateItemDiscountInput(item: StockItem, value: string) {
    const parsed = this.parseDiscount(value);
    item.discount = parsed;
  }

  updateGlobalDiscountInput(value: string) {
    if (!this.order) return;
    this.order.globalDiscount = this.parseDiscount(value);
  }

  formatDiscount(discount?: Discount | null): string {
    if (!discount) return '';
    return discount.type === 'percent'
      ? `${discount.value || 0}%`
      : `$${discount.value || 0}`;
  }

  private parseDiscount(value: string): Discount | undefined {
    const raw = (value || '').trim();
    if (!raw) return undefined;

    const isPercent = raw.includes('%');
    const numeric = parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;

    return isPercent
      ? { type: 'percent', value: numeric }
      : { type: 'amount', value: numeric };
  }

  updateOrder() {
    if (!this.order) return;
    this.salesOrdersService.updateOrder(this.order);
  }

  itemPrice(item: StockItem): number {
    const billableDays = item.billableDays ?? this.order?.billableDays ?? 1;
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
      .reduce((sum, item) => sum + this.itemPrice(item), 0);
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

  openEdit(section: EditSection) {
    if (!this.order) return;
    this.activeEdit = section;

    if (section === 'schedule') {
      this.draftSchedule = {
        startDate: this.order.startDate,
        endDate: this.order.endDate,
        billableDays: this.order.billableDays,
        rentalPeriodDays: this.order.rentalPeriodDays,
      };
    }

    if (section === 'customer') {
      this.draftCustomer = {
        customer: this.order.customer,
        deliveryLocation: this.order.deliveryLocation,
        serviceBranch: this.order.serviceBranch,
        status: this.order.status,
        warehouseStatus: this.order.warehouseStatus,
        orderType: this.order.orderType,
        tags: this.order.tags.join(', '),
      };
    }

    if (section === 'financial') {
      this.draftFinancial = {
        discount: this.order.globalDiscount
          ? { ...this.order.globalDiscount }
          : { type: 'percent', value: 0 },
        customerReference: this.order.customerReference,
        totalDiscount: this.order.totalDiscount,
      };
    }
  }

  closeEdit() {
    this.activeEdit = null;
  }

  saveSchedule() {
    if (!this.order) return;
    this.order.startDate = this.draftSchedule.startDate;
    this.order.endDate = this.draftSchedule.endDate;
    this.order.billableDays = Number(this.draftSchedule.billableDays) || 1;
    this.order.rentalPeriodDays =
      Number(this.draftSchedule.rentalPeriodDays) || 1;
    this.closeEdit();
  }

  saveCustomer() {
    if (!this.order) return;
    this.order.customer = this.draftCustomer.customer;
    this.order.deliveryLocation = this.draftCustomer.deliveryLocation;
    this.order.serviceBranch = this.draftCustomer.serviceBranch;
    this.order.status = this.draftCustomer.status;
    this.order.warehouseStatus = this.draftCustomer.warehouseStatus;
    this.order.orderType = this.draftCustomer.orderType;
    this.order.tags = this.draftCustomer.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    this.closeEdit();
  }

  saveFinancial() {
    if (!this.order) return;
    this.order.globalDiscount = this.draftFinancial.discount
      ? { ...this.draftFinancial.discount }
      : undefined;
    this.order.customerReference = this.draftFinancial.customerReference;
    this.order.totalDiscount = Number(this.draftFinancial.totalDiscount) || 0;
    this.closeEdit();
  }

  formatDiscountDraft(): string {
    return this.formatDiscount(this.draftFinancial.discount);
  }

  updateDraftFinancialDiscount(value: string) {
    this.draftFinancial.discount = this.parseDiscount(value);
  }
}
