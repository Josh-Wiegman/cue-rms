import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { SalesOrdersService, SalesOrderSummary } from '../sales-orders.service';

@Component({
  selector: 'sales-component',
  standalone: true,
  imports: [UiShellComponent, CommonModule, FormsModule, RouterLink, DatePipe],
  templateUrl: './sales-component.html',
  styleUrl: './sales-component.scss',
})
export class SalesComponent implements OnInit, OnDestroy {
  orders: SalesOrderSummary[] = [];
  searchTerm = '';
  branchFilter = 'All';
  dateFrom = '';
  dateTo = '';
  showCreateModal = false;
  newOrder = this.getBlankOrder();

  private readonly subscriptions: Subscription[] = [];

  constructor(
    private readonly salesOrdersService: SalesOrdersService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.subscriptions.push(
      this.salesOrdersService.orders$.subscribe(
        (orders) => (this.orders = orders),
      ),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get branches(): string[] {
    const unique = Array.from(new Set(this.orders.map((order) => order.branch)));
    return ['All', ...unique];
  }

  get filteredOrders(): SalesOrderSummary[] {
    const term = this.searchTerm.toLowerCase();
    return this.orders
      .filter((order) =>
        this.branchFilter === 'All' ? true : order.branch === this.branchFilter,
      )
      .filter((order) =>
        term
          ? [order.orderNumber, order.title, order.accountManager]
              .join(' ')
              .toLowerCase()
              .includes(term)
          : true,
      )
      .filter((order) => {
        if (this.dateFrom && new Date(order.startDate) < new Date(this.dateFrom))
          return false;
        if (this.dateTo && new Date(order.endDate) > new Date(this.dateTo))
          return false;
        return true;
      });
  }

  clearFilters() {
    this.searchTerm = '';
    this.branchFilter = 'All';
    this.dateFrom = '';
    this.dateTo = '';
  }

  openCreateModal() {
    this.newOrder = this.getBlankOrder();
    this.showCreateModal = true;
  }

  closeCreateModal() {
    this.showCreateModal = false;
  }

  createOrder() {
    const created = this.salesOrdersService.createOrder({
      title: this.newOrder.title,
      accountManager: this.newOrder.accountManager,
      startDate: this.newOrder.startDate,
      endDate: this.newOrder.endDate,
      branch: this.newOrder.branch,
      customer: this.newOrder.customer,
      deliveryLocation: this.newOrder.deliveryLocation,
      serviceBranch: this.newOrder.serviceBranch,
      orderType: this.newOrder.orderType,
      status: 'Quote',
      warehouseStatus: 'To Prep',
      tags: [],
      groups: [],
      billableDays: 1,
      rentalPeriodDays: 1,
      totalDiscount: 0,
    });
    this.closeCreateModal();
    this.router.navigate(['/sales', created.orderNumber]);
  }

  private getBlankOrder() {
    const today = new Date().toISOString().slice(0, 10);
    return {
      title: '',
      accountManager: '',
      startDate: today,
      endDate: today,
      branch: 'Christchurch',
      customer: '',
      deliveryLocation: '',
      serviceBranch: 'Christchurch',
      orderType: 'Dry Hire' as const,
    };
  }
}
