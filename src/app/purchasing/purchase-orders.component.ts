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
import { OrgBrandingService } from '../shared/org-branding/org-branding.service';
import { OrganisationBranding } from '../auth/models/auth-user.model';
import { AuthService } from '../auth/auth.service';

interface DraftItem extends PurchaseOrderItem {
  suggestionTerm?: string;
  suggestions?: { description: string; sku: string; price: number }[];
}

@Component({
  selector: 'app-purchase-orders',
  standalone: true,
  imports: [
    UiShellComponent,
    CommonModule,
    FormsModule,
    DatePipe,
    CurrencyPipe,
  ],
  templateUrl: './purchase-orders.component.html',
  styleUrl: './purchase-orders.component.scss',
})
export class PurchaseOrdersComponent implements OnInit, OnDestroy {
  activeOrders: PurchaseOrder[] = [];
  archivedOrders: PurchaseOrder[] = [];
  showArchived = false;

  detailModalOpen = false;
  selectedOrder?: PurchaseOrder;
  editableOrder?: PurchaseOrder & { items: DraftItem[] };
  orgBranding: OrganisationBranding | null = null;

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

  // 🔧 FIX: don't call blankOrder() here (service DI not ready yet)
  newOrder!: PurchaseOrder & { items: DraftItem[] };

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly orgBrandingService: OrgBrandingService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.purchaseOrdersService.orders$.subscribe((orders) => {
        this.activeOrders = orders.filter(
          (order) => !this.purchaseOrdersService.isArchived(order),
        );
        this.archivedOrders = orders.filter((order) =>
          this.purchaseOrdersService.isArchived(order),
        );
      }),
    );

    // 🔧 FIX: initialise draft order here where DI is safe
    this.newOrder = this.blankOrder();

    this.loadBranding();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get displayedOrders(): PurchaseOrder[] {
    return this.showArchived ? this.archivedOrders : this.activeOrders;
  }

  get branches(): string[] {
    return this.purchaseOrdersService
      .getBranches()
      .map((branch) => branch.name);
  }

  openCreateModal() {
    this.newOrder = this.blankOrder();
    this.creationModalOpen = true;
  }

  closeCreateModal() {
    this.creationModalOpen = false;
  }

  openDetailModal(order: PurchaseOrder) {
    this.selectedOrder = order;
    this.editableOrder = this.cloneForEdit(order);
    this.detailModalOpen = true;
  }

  closeDetailModal() {
    this.detailModalOpen = false;
    this.selectedOrder = undefined;
    this.editableOrder = undefined;
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

  addEditLineItem() {
    if (!this.editableOrder) return;
    this.editableOrder.items.push({
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      price: 0,
      suggestions: [],
    });
  }

  removeLineItem(index: number) {
    this.newOrder.items.splice(index, 1);
  }

  removeEditLineItem(index: number) {
    this.editableOrder?.items.splice(index, 1);
  }

  updateBranch(branch: string) {
    const profile = this.purchaseOrdersService.findBranchProfile(branch);
    this.newOrder.recipientBranch = branch;
    this.newOrder.branch = branch;
    this.newOrder.deliveryAddress = profile.address;
    this.newOrder.deliveryContact = profile.contact;
  }

  updateEditBranch(branch: string) {
    if (!this.editableOrder) return;
    const profile = this.purchaseOrdersService.findBranchProfile(branch);
    this.editableOrder.recipientBranch = branch;
    this.editableOrder.branch = branch;
    this.editableOrder.deliveryAddress = profile.address;
    this.editableOrder.deliveryContact = profile.contact;
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

  applySuggestion(
    item: DraftItem,
    suggestion: { description: string; sku: string; price: number },
  ) {
    item.description = suggestion.description;
    item.sku = suggestion.sku;
    item.price = suggestion.price;
    item.suggestions = [];
  }

  clearSuggestions(item: DraftItem) {
    item.suggestions = [];
  }

  async saveEdits() {
    if (!this.selectedOrder || !this.editableOrder) return;

    const items: PurchaseOrderItem[] = this.editableOrder.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      sku: item.sku,
    }));

    this.purchaseOrdersService.updateOrder(this.selectedOrder.id, {
      vendor: this.editableOrder.vendor,
      branch: this.editableOrder.branch,
      recipientBranch: this.editableOrder.recipientBranch,
      deliveryContact: this.editableOrder.deliveryContact,
      deliveryAddress: this.editableOrder.deliveryAddress,
      expectedArrival: this.editableOrder.expectedArrival,
      trackingNumber: this.editableOrder.trackingNumber,
      carrier: this.editableOrder.carrier,
      status: this.editableOrder.status,
      items,
    });

    this.closeDetailModal();
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

  async export(order: PurchaseOrder, type: 'rfq' | 'po' | 'delivery') {
    try {
      await this.purchaseOrdersService.exportDocumentPdf(order, type, {
        name: this.orgBranding?.name,
        logoUrl: this.orgBranding?.logoUrl,
      });
    } catch (err) {
      console.error('Failed to export document', err);
      alert('Unable to export this document to PDF right now.');
    }
  }

  private blankOrder(createdOn?: string) {
    const today = createdOn ?? new Date().toISOString().slice(0, 10);
    const defaultArrival = new Date(today);
    defaultArrival.setDate(defaultArrival.getDate() + 7);
    const profile =
      this.purchaseOrdersService.findBranchProfile('Christchurch');

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
      updatedOn: today,
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

  private cloneForEdit(
    order: PurchaseOrder,
  ): PurchaseOrder & { items: DraftItem[] } {
    return {
      ...order,
      items: order.items.map((item) => ({ ...item, suggestions: [] })),
    };
  }

  private async loadBranding() {
    try {
      this.orgBranding = await this.orgBrandingService.getBranding(
        this.authService.orgSlug,
      );
    } catch (err) {
      console.warn('Unable to load branding for purchase orders', err);
    }
  }

  // 🔧 FIX: template totals use these (no inline reduce)
  get newOrderTotal(): number {
    if (!this.newOrder || !this.newOrder.items) return 0;
    return this.newOrder.items.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      return acc + qty * price;
    }, 0);
  }

  get editableOrderTotal(): number {
    if (!this.editableOrder || !this.editableOrder.items) return 0;
    return this.editableOrder.items.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      return acc + qty * price;
    }, 0);
  }
}
