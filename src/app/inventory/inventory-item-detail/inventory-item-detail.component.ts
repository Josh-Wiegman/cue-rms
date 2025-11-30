import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { InventoryItem } from '../../shared/models-and-mappers/item/item-model';
import { InventoryService } from '../inventory.service';
import { PreferencesService } from '../../shared/preferences/preferences.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'inventory-item-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink, UiShellComponent, FormsModule],
  templateUrl: './inventory-item-detail.component.html',
  styleUrl: './inventory-item-detail.component.scss',
})
export class InventoryItemDetailComponent implements OnInit, OnDestroy {
  item?: InventoryItem;
  selectedWarehouse = '';
  showEditDialog = false;
  editDraft: Partial<InventoryItem> = {};
  private subscriptions: Subscription[] = [];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly inventoryService: InventoryService,
    private readonly preferencesService: PreferencesService,
  ) {}

  ngOnInit(): void {
    const sku = this.route.snapshot.paramMap.get('sku');
    if (sku) {
      this.item = this.inventoryService.getBySku(sku);
      if (this.item && this.item.warehouseQuantities.length) {
        this.selectedWarehouse =
          this.preferencesService.getDefaultWarehouse() ||
          this.item.warehouseQuantities[0].warehouse;
      }
    }
    this.subscriptions.push(
      this.preferencesService.defaultWarehouse$.subscribe((warehouse) => {
        this.selectedWarehouse = warehouse || this.selectedWarehouse;
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }

  goToAvailability(): void {
    if (!this.item) return;
    this.router.navigate(['/inventory', this.item.sku, 'availability']);
  }

  getNextTestDate(item: InventoryItem): string | undefined {
    if (!item.lastTested || !item.nextTestDueMonths) return undefined;
    const base = new Date(item.lastTested);
    base.setMonth(base.getMonth() + item.nextTestDueMonths);
    return base.toISOString();
  }

  quantityForWarehouse(): number {
    if (!this.item) return 0;
    const allocation = this.item.warehouseQuantities.find(
      (entry) => entry.warehouse === this.selectedWarehouse,
    );
    return allocation?.quantity ?? 0;
  }

  availableForWarehouse(): number {
    if (!this.item) return 0;
    const allocation = this.item.warehouseQuantities.find(
      (entry) => entry.warehouse === this.selectedWarehouse,
    );
    if (allocation?.quantityAvailable !== undefined) {
      return allocation.quantityAvailable;
    }

    if (!allocation || this.item.quantity === 0) return 0;

    const proportion = allocation.quantity / this.item.quantity;
    return Math.round(this.item.quantityAvailable * proportion);
  }

  startEdit(): void {
    if (!this.item) return;
    this.editDraft = {
      name: this.item.name,
      category: this.item.category,
      unitDayRate: this.item.unitDayRate,
      pricing: { ...this.item.pricing },
      productCost: this.item.productCost,
      subhireCost: this.item.subhireCost,
    };
    this.showEditDialog = true;
  }

  saveEdit(): void {
    if (!this.item) return;
    const updated = this.inventoryService.updateItem(this.item.sku, this.editDraft);
    if (updated) {
      this.item = updated;
    }
    this.showEditDialog = false;
  }
}
