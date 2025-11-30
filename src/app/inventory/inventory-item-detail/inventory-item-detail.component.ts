import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { InventoryItem } from '../../shared/models-and-mappers/item/item-model';
import { InventoryService } from '../inventory.service';

@Component({
  selector: 'inventory-item-detail',
  standalone: true,
  imports: [CommonModule, CurrencyPipe, DatePipe, RouterLink, UiShellComponent],
  templateUrl: './inventory-item-detail.component.html',
  styleUrl: './inventory-item-detail.component.scss',
})
export class InventoryItemDetailComponent implements OnInit {
  item?: InventoryItem;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly inventoryService: InventoryService,
  ) {}

  ngOnInit(): void {
    const sku = this.route.snapshot.paramMap.get('sku');
    if (sku) {
      this.item = this.inventoryService.getBySku(sku);
    }
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
}
