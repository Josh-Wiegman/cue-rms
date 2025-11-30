import { CommonModule, CurrencyPipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import {
  InventoryItem,
  ItemMode,
  ItemType,
  TestInterval,
  WarehouseQuantity,
} from '../../shared/models-and-mappers/item/item-model';
import { InventoryService } from '../inventory.service';
import { Subscription } from 'rxjs';

interface NewItemForm {
  name: string;
  category: string;
  unitDayRate: number;
  itemType: ItemType;
  itemMode: ItemMode;
  pricing: { oneDay?: number; threeDay?: number; week?: number };
  productCost: number;
  subhireCost: number;
  weightKg?: number;
  dimensionsMm?: string;
  roadcaseSize?: InventoryItem['roadcaseSize'];
  roadcaseQuantity?: number;
  lastTested?: string;
  nextTestDueMonths?: TestInterval;
  accessories?: string;
  accessoryTo?: string;
}

@Component({
  selector: 'inventory-component',
  standalone: true,
  imports: [
    UiShellComponent,
    CurrencyPipe,
    CommonModule,
    FormsModule,
    RouterLink,
  ],
  templateUrl: './inventory-component.html',
  styleUrl: './inventory-component.scss',
})
export class InventoryComponent implements OnInit, OnDestroy {
  items: InventoryItem[] = [];
  private subscriptions: Subscription[] = [];

  sortColumn: keyof InventoryItem | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  showNewItemDialog = false;
  warehouses = ['Main Warehouse', 'Tour Prep', 'Festival Site', 'Dry Hire Counter'];
  warehouseSelection = this.warehouses[0];
  warehouseQuantity = 1;
  warehouseAllocations: WarehouseQuantity[] = [];

  newItem: NewItemForm = this.buildBlankForm();

  constructor(private readonly inventoryService: InventoryService) {}

  ngOnInit() {
    this.subscriptions.push(
      this.inventoryService.items$.subscribe((items) => (this.items = items)),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  get sortedItems(): InventoryItem[] {
    if (!this.sortColumn) return this.items;

    return [...this.items].sort((a, b) => {
      const aVal = a[this.sortColumn];
      const bVal = b[this.sortColumn];

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return this.sortDirection === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
  }

  sortData(column: keyof InventoryItem) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  openNewItemDialog() {
    this.showNewItemDialog = true;
    this.newItem = this.buildBlankForm();
    this.warehouseAllocations = [];
    this.warehouseSelection = this.warehouses[0];
    this.warehouseQuantity = 1;
  }

  closeDialog() {
    this.showNewItemDialog = false;
  }

  addWarehouseAllocation() {
    if (!this.warehouseSelection || this.warehouseQuantity <= 0) return;
    const existing = this.warehouseAllocations.find(
      (allocation) => allocation.warehouse === this.warehouseSelection,
    );

    if (existing) {
      existing.quantity += this.warehouseQuantity;
    } else {
      this.warehouseAllocations = [
        ...this.warehouseAllocations,
        { warehouse: this.warehouseSelection, quantity: this.warehouseQuantity },
      ];
    }

    this.warehouseQuantity = 1;
  }

  removeWarehouseAllocation(warehouse: string) {
    this.warehouseAllocations = this.warehouseAllocations.filter(
      (allocation) => allocation.warehouse !== warehouse,
    );
  }

  submitNewItem() {
    const allocation =
      this.warehouseAllocations.length > 0
        ? this.warehouseAllocations
        : [{ warehouse: this.warehouseSelection, quantity: this.warehouseQuantity }];

    const totalQuantity = allocation.reduce((sum, entry) => sum + entry.quantity, 0);
    const pricing = {
      oneDay: this.newItem.pricing.oneDay ?? this.newItem.unitDayRate,
      threeDay:
        this.newItem.pricing.threeDay ?? Math.round(this.newItem.unitDayRate * 2.5),
      week: this.newItem.pricing.week ?? Math.round(this.newItem.unitDayRate * 4),
    };

    this.inventoryService.addItem({
      name: this.newItem.name,
      category: this.newItem.category,
      quantity: totalQuantity,
      quantityAvailable: totalQuantity,
      unitDayRate: this.newItem.unitDayRate,
      itemType: this.newItem.itemType,
      itemMode: this.newItem.itemMode,
      pricing,
      productCost: this.newItem.productCost,
      subhireCost: this.newItem.subhireCost,
      weightKg: this.newItem.weightKg,
      dimensionsMm: this.newItem.dimensionsMm,
      roadcaseSize: this.newItem.roadcaseSize,
      roadcaseQuantity: this.newItem.roadcaseQuantity,
      lastTested: this.newItem.lastTested,
      nextTestDueMonths: this.newItem.nextTestDueMonths,
      accessories: this.parseCSV(this.newItem.accessories),
      accessoryTo: this.parseCSV(this.newItem.accessoryTo),
      relatedSalesOrders: [],
      relatedRepairOrders: [],
      relatedTransferOrders: [],
      warehouseQuantities: allocation,
      availabilityBookings: [],
      imageUrl:
        'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80',
    });

    this.closeDialog();
  }

  get allocationPreview(): WarehouseQuantity[] {
    return this.warehouseAllocations.length > 0
      ? this.warehouseAllocations
      : [{ warehouse: this.warehouseSelection, quantity: this.warehouseQuantity }];
  }

  totalWarehouseQuantity(warehouse: WarehouseQuantity[]): number {
    return warehouse.reduce((sum, entry) => sum + entry.quantity, 0);
  }

  private buildBlankForm(): NewItemForm {
    return {
      name: '',
      category: '',
      unitDayRate: 0,
      itemType: 'rental',
      itemMode: 'Bulk',
      pricing: {},
      productCost: 0,
      subhireCost: 0,
      weightKg: undefined,
      dimensionsMm: undefined,
      roadcaseSize: undefined,
      roadcaseQuantity: undefined,
      lastTested: undefined,
      nextTestDueMonths: 12,
      accessories: undefined,
      accessoryTo: undefined,
    };
  }

  private parseCSV(value?: string): string[] {
    if (!value) return [];
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
}
