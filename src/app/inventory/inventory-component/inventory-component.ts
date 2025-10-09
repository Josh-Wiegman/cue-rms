/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component } from '@angular/core';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { dbFunctionsService } from '../../shared/supabase-service/db_functions.service';
import { Item } from '../../shared/models-and-mappers/item/item-model';
import { CommonModule, CurrencyPipe } from '@angular/common';

@Component({
  selector: 'inventory-component',
  imports: [UiShellComponent, CurrencyPipe, CommonModule],
  templateUrl: './inventory-component.html',
  styleUrl: './inventory-component.scss',
})
export class InventoryComponent {
  items: any = [];

  constructor(private dbFunctions: dbFunctionsService) {}

  async ngOnInit() {
    await this.loadInventory();
  }

  async loadInventory() {
    this.items = await this.dbFunctions.getItems();
    console.log('Jobs loaded:', this.items);
  }

  selectedIds = new Set<number>();

  sortColumn: keyof Item | '' = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  get sortedItems(): Item[] {
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

  sortData(column: keyof Item) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  isSelected(id: number): boolean {
    return this.selectedIds.has(id);
  }

  toggleSelection(id: number) {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
  }

  isAllSelected(): boolean {
    return this.selectedIds.size === this.items.length;
  }

  toggleSelectAll(event: Event) {
    const checkbox = event.target as HTMLInputElement;
    if (checkbox.checked) {
      this.selectedIds = new Set(this.items.map((item: Item) => item.id));
    } else {
      this.selectedIds.clear();
    }
  }

  performActionOnSelected() {
    const selectedItems = this.items.filter((item: Item) =>
      this.selectedIds.has(item.id),
    );
    console.log('Performing action on:', selectedItems);
    // TODO: Replace with actual action logic
  }
}
