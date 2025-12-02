import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiShellComponent } from '../shared/ui-shell/ui-shell-component';
import {
  FreightCarrier,
  PurchaseOrder,
  PurchaseOrderItem,
  PurchaseOrderStatus,
  PurchaseOrdersService,
} from './purchase-orders.service';
import { Subscription } from 'rxjs';

interface DraftItem extends PurchaseOrderItem {
  suggestionTerm?: string;
  suggestions?: { description: string; sku: string; price: number }[];
}

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [UiShellComponent, CommonModule, FormsModule, DatePipe, CurrencyPipe],
  templateUrl: './purchase-orders.component.html',
  styleUrl: './purchase-orders.component.scss',
})
export class PurchaseOrdersComponent implements OnInit, OnDestroy {
  activeOrders: PurchaseOrder[] = [];
  archivedOrders: PurchaseOrder[] = [];
  showArchived = false;

  creationModalOpen = false;
  creationStatus: PurchaseOrderStatus = 'Ordered';
  carriers: FreightCarrier[] = [
    'NZPost',
    'Mainfreight',
    'FedEx',
    'DHL',
    'Mainstream',
    'Team Global Express',
    'NZ Couriers',
    'Posthaste',
  ];

  newOrder = this.blankOrder();

  private readonly subscriptions: Subscription[] = [];

  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.purchaseOrdersService.orders$.subscribe((orders) => {
        this.activeOrders = this.purchaseOrdersService.activeOrders;
        this.archivedOrders = this.purchaseOrdersService.archivedOrders;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get displayedOrders(): PurchaseOrder[] {
    return this.showArchived ? this.archivedOrders : this.activeOrders;
  }

  get branches(): string[] {
    return this.purchaseOrdersService.getBranches().map((branch) => branch.name);
  }

  openCreateModal() {
    this.newOrder = this.blankOrder();
    this.creationModalOpen = true;
  }

  closeCreateModal() {
    this.creationModalOpen = false;
  }

  addLineItem() {
    this.newOrder.items.push({
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      price: 0,
      suggestionTerm: '',
      suggestions: [],
    });
  }

  removeLineItem(index: number) {
    this.newOrder.items.splice(index, 1);
  }

  updateBranch(branch: string) {
    const profile = this.purchaseOrdersService.findBranchProfile(branch);
    this.newOrder.recipientBranch = branch;
    this.newOrder.branch = branch;
    this.newOrder.deliveryAddress = profile.address;
    this.newOrder.deliveryContact = profile.contact;
  }

  searchInventory(item: DraftItem) {
    item.suggestions = this.purchaseOrdersService
      .findInventoryMatches(item.description)
      .map((match) => ({
        description: match.name,
        sku: match.sku,
        price: match.productCost,
      }));
  }

  applySuggestion(item: DraftItem, suggestion: { description: string; sku: string; price: number }) {
    item.description = suggestion.description;
    item.sku = suggestion.sku;
    item.price = suggestion.price;
    item.suggestions = [];
  }

  clearSuggestions(item: DraftItem) {
    item.suggestions = [];
  }

  createOrder() {
    if (!this.newOrder.vendor.trim()) return;
    if (!this.newOrder.items.length) return;

    const payloadItems = this.newOrder.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      sku: item.sku,
    }));

    const created = this.purchaseOrdersService.createOrder({
      vendor: this.newOrder.vendor,
      branch: this.newOrder.branch,
      recipientBranch: this.newOrder.recipientBranch,
      deliveryContact: this.newOrder.deliveryContact,
      deliveryAddress: this.newOrder.deliveryAddress,
      expectedArrival: this.newOrder.expectedArrival,
      trackingNumber: this.newOrder.trackingNumber,
      carrier: this.newOrder.carrier,
      status: this.creationStatus,
      items: payloadItems,
    });

    this.closeCreateModal();
    this.showArchived = false;
    this.creationStatus = 'Ordered';
    this.newOrder = this.blankOrder(created.createdOn);
  }

  changeStatus(order: PurchaseOrder, status: PurchaseOrderStatus) {
    this.purchaseOrdersService.updateOrderStatus(order.id, status);
  }

  totalFor(order: PurchaseOrder): number {
    return this.purchaseOrdersService.calculateTotal(order);
  }

  export(order: PurchaseOrder, type: 'rfq' | 'po' | 'delivery') {
    const text = this.purchaseOrdersService.exportDocument(order, type);
    const blob = new Blob([text], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${order.poNumber}-${type}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  private blankOrder(createdOn?: string) {
    const today = createdOn ?? new Date().toISOString().slice(0, 10);
    const defaultArrival = new Date(today);
    defaultArrival.setDate(defaultArrival.getDate() + 7);
    const profile = this.purchaseOrdersService.findBranchProfile('Christchurch');

    const draft: PurchaseOrder & { items: DraftItem[] } = {
      id: '',
      poNumber: '',
      vendor: '',
      branch: profile.name,
      recipientBranch: profile.name,
      deliveryContact: profile.contact,
      deliveryAddress: profile.address,
      status: 'Ordered',
      trackingNumber: '',
      carrier: undefined,
      expectedArrival: defaultArrival.toISOString().slice(0, 10),
      createdOn: today,
      items: [
        {
          id: crypto.randomUUID(),
          description: '',
          quantity: 1,
          price: 0,
          suggestions: [],
        },
      ],
    };

    return draft;
  }
}
