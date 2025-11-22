import { Injectable } from '@angular/core';
import {
  NewPartyHireOrder,
  PartyHireCalendarEvent,
  PartyHireOrder,
  PartyHireOrderItem,
  PartyHireOrderStatus,
  PartyHireStockItem,
} from './partyhire.models';

const DEFAULT_STOCK: PartyHireStockItem[] = [
  {
    id: 1,
    name: 'Battery Festoon Kit (20m)',
    category: 'Lighting',
    total: 12,
    allocated: 2,
    unitPrice: 95,
  },
  {
    id: 2,
    name: 'Corded Festoon Kit (20m)',
    category: 'Lighting',
    total: 10,
    allocated: 1,
    unitPrice: 75,
  },
  {
    id: 3,
    name: 'Par 64 RGB Uplight',
    category: 'Lighting',
    total: 30,
    allocated: 12,
    unitPrice: 35,
  },
  {
    id: 4,
    name: 'Portable Speaker (Battery)',
    category: 'Audio',
    total: 16,
    allocated: 3,
    unitPrice: 80,
  },
  {
    id: 5,
    name: '2m Box Truss',
    category: 'Theming',
    total: 24,
    allocated: 8,
    unitPrice: 55,
  },
];

@Injectable({ providedIn: 'root' })
export class PartyHireService {
  private readonly stock: PartyHireStockItem[] = structuredClone(DEFAULT_STOCK);
  private readonly orders: PartyHireOrder[] = [];

  listStock(): PartyHireStockItem[] {
    return this.stock.map((item) => ({ ...item }));
  }

  listOrders(): PartyHireOrder[] {
    return this.orders.map((order) => ({ ...order }));
  }

  createOrder(payload: NewPartyHireOrder): PartyHireOrder {
    const now = new Date();
    const id = crypto.randomUUID();
    const reference = this.buildReference(now);
    const quoteNumber = this.buildQuoteNumber(now);
    const invoiceNumber = this.buildInvoiceNumber(now);

    const items: PartyHireOrderItem[] = payload.items.map((item) => {
      const stock = this.getStock(item.stockId);
      return {
        stockId: item.stockId,
        name: stock?.name ?? 'Unknown item',
        quantity: item.quantity,
        unitPrice: stock?.unitPrice ?? 0,
      };
    });

    this.reserveStock(items);
    const totals = this.calculateTotals(items);
    const calendarEvent = this.buildCalendarEvent(payload, reference, totals.total);

    const order: PartyHireOrder = {
      id,
      reference,
      quoteNumber,
      invoiceNumber,
      customerName: payload.customerName,
      contactEmail: payload.contactEmail,
      contactPhone: payload.contactPhone,
      eventName: payload.eventName,
      startDate: payload.startDate,
      endDate: payload.endDate,
      location: payload.location,
      deliveryMethod: payload.deliveryMethod,
      notes: payload.notes,
      recipients: payload.recipients,
      items,
      totals,
      status: 'Prepped',
      calendarEvent,
      createdAt: now.toISOString(),
    };

    this.orders.unshift(order);
    return { ...order };
  }

  updateStatus(orderId: string, status: PartyHireOrderStatus): PartyHireOrder {
    const order = this.findOrder(orderId);
    order.status = status;
    return { ...order };
  }

  recordReturn(
    orderId: string,
    returnedItems: Record<number, number>,
    status: PartyHireOrderStatus,
  ): PartyHireOrder {
    const order = this.findOrder(orderId);

    const releaseItems = order.items.map((item) => ({
      ...item,
      quantity: Math.min(item.quantity, returnedItems[item.stockId] ?? 0),
    }));

    this.releaseStock(releaseItems);
    order.status = status;
    order.returnedItems = returnedItems;
    return { ...order };
  }

  regenerateCalendar(orderId: string): PartyHireCalendarEvent {
    const order = this.findOrder(orderId);
    order.calendarEvent = this.buildCalendarEvent(
      {
        customerName: order.customerName,
        contactEmail: order.contactEmail,
        contactPhone: order.contactPhone,
        eventName: order.eventName,
        startDate: order.startDate,
        endDate: order.endDate,
        location: order.location,
        deliveryMethod: order.deliveryMethod,
        notes: order.notes,
        recipients: order.recipients,
        items: order.items.map((item) => ({
          stockId: item.stockId,
          quantity: item.quantity,
        })),
      },
      order.reference,
      order.totals.total,
    );
    return { ...order.calendarEvent };
  }

  private reserveStock(items: PartyHireOrderItem[]): void {
    for (const item of items) {
      const stock = this.getStock(item.stockId);
      if (stock) stock.allocated += item.quantity;
    }
  }

  private releaseStock(items: PartyHireOrderItem[]): void {
    for (const item of items) {
      const stock = this.getStock(item.stockId);
      if (!stock) continue;
      stock.allocated = Math.max(0, stock.allocated - item.quantity);
    }
  }

  private buildReference(now: Date): string {
    const datePart = now.toISOString().slice(0, 10).replaceAll('-', '');
    const sequence = String(this.orders.length + 1).padStart(3, '0');
    return `PH-${datePart}-${sequence}`;
  }

  private buildQuoteNumber(now: Date): string {
    return `Q-PH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
      this.orders.length + 101
    }`;
  }

  private buildInvoiceNumber(now: Date): string {
    return `INV-PH-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${
      this.orders.length + 501
    }`;
  }

  private calculateTotals(items: PartyHireOrderItem[]) {
    const subtotal = items.reduce(
      (total, item) => total + item.quantity * item.unitPrice,
      0,
    );
    const gst = subtotal * 0.15;
    const total = subtotal + gst;

    return { subtotal, gst, total };
  }

  private buildCalendarEvent(
    payload: NewPartyHireOrder,
    reference: string,
    total: number,
  ): PartyHireCalendarEvent {
    const summary = `PartyHire: ${payload.eventName} (${reference})`;
    const description = this.calendarDescription(payload, reference, total);
    const googleCalendarUrl = this.googleCalendarUrl(
      payload.startDate,
      payload.endDate,
      summary,
      description,
      payload.location,
      payload.recipients,
    );

    return {
      summary,
      start: payload.startDate,
      end: payload.endDate,
      location: payload.location,
      description,
      attendees: payload.recipients,
      googleCalendarUrl,
    };
  }

  private calendarDescription(
    payload: NewPartyHireOrder,
    reference: string,
    total: number,
  ): string {
    return [
      `Reference: ${reference}`,
      `Customer: ${payload.customerName} (${payload.contactEmail})`,
      `Event: ${payload.eventName}`,
      `Location: ${payload.location}`,
      `Delivery: ${payload.deliveryMethod.toUpperCase()}`,
      `Hire total: $${total.toFixed(2)}`,
      payload.notes ? `Notes: ${payload.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private googleCalendarUrl(
    startIso: string,
    endIso: string,
    summary: string,
    description: string,
    location: string,
    attendees: string[],
  ): string {
    const start = this.toCalendarDate(startIso);
    const end = this.toCalendarDate(endIso);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: summary,
      dates: `${start}/${end}`,
      details: description,
      location,
      add: attendees.join(','),
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  private toCalendarDate(date: string): string {
    const value = new Date(date);
    const pad = (num: number) => String(num).padStart(2, '0');
    const year = value.getUTCFullYear();
    const month = pad(value.getUTCMonth() + 1);
    const day = pad(value.getUTCDate());
    const hours = pad(value.getUTCHours());
    const minutes = pad(value.getUTCMinutes());
    const seconds = pad(value.getUTCSeconds());
    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  private getStock(stockId: number): PartyHireStockItem | undefined {
    return this.stock.find((item) => item.id === stockId);
  }

  private findOrder(orderId: string): PartyHireOrder {
    const order = this.orders.find((existing) => existing.id === orderId);
    if (!order) throw new Error('Order not found');
    return order;
  }
}
