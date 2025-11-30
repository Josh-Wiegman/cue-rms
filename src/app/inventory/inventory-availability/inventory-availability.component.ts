import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { InventoryItem, ItemBooking } from '../../shared/models-and-mappers/item/item-model';
import { InventoryService } from '../inventory.service';

@Component({
  selector: 'inventory-availability',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, UiShellComponent],
  templateUrl: './inventory-availability.component.html',
  styleUrl: './inventory-availability.component.scss',
})
export class InventoryAvailabilityComponent implements OnInit {
  item?: InventoryItem;
  bookings: ItemBooking[] = [];
  rangeStart?: Date;
  rangeEnd?: Date;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly inventoryService: InventoryService,
  ) {}

  ngOnInit(): void {
    const sku = this.route.snapshot.paramMap.get('sku');
    if (!sku) return;

    this.item = this.inventoryService.getBySku(sku);
    this.bookings = this.item?.availabilityBookings ?? [];
    this.computeRange();
  }

  computeRange() {
    if (!this.bookings.length) return;
    const starts = this.bookings.map((b) => new Date(b.startDate));
    const ends = this.bookings.map((b) => new Date(b.endDate));
    this.rangeStart = new Date(Math.min(...starts.map((d) => d.getTime())));
    this.rangeEnd = new Date(Math.max(...ends.map((d) => d.getTime())));
  }

  barStyle(booking: ItemBooking): Record<string, string> {
    if (!this.rangeStart || !this.rangeEnd) return {};
    const totalMs = this.rangeEnd.getTime() - this.rangeStart.getTime();
    const startOffset = new Date(booking.startDate).getTime() -
      this.rangeStart.getTime();
    const durationMs = Math.max(
      new Date(booking.endDate).getTime() -
        new Date(booking.startDate).getTime(),
      24 * 60 * 60 * 1000,
    );
    const total = totalMs || 1;
    return {
      left: `${(startOffset / total) * 100}%`,
      width: `${(durationMs / total) * 100}%`,
    };
  }
}
