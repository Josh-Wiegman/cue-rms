export type PartyHireOrderStatus =
  | 'Draft'
  | 'Prepped'
  | 'Collected'
  | 'Returned'
  | 'Missing'
  | 'Partial Return';

export interface PartyHireStockItem {
  id: number;
  sku?: string;
  name: string;
  category: string;
  total: number;
  allocated: number;
  unitPrice: number;
  available?: number;
  description?: string;
}

export interface PartyHireOrderItem {
  stockId: number;
  name: string;
  quantity: number;
  unitPrice: number;
  returnedQuantity?: number;
}

export interface PartyHireCalendarEvent {
  summary: string;
  start: string;
  end: string;
  location: string;
  description: string;
  attendees: string[];
  googleCalendarUrl: string;
}

export interface PartyHireOrder {
  id: string;
  reference: string;
  quoteNumber: string;
  invoiceNumber: string;
  customerName: string;
  contactEmail: string;
  contactPhone?: string;
  eventName: string;
  startDate: string;
  endDate: string;
  location: string;
  deliveryMethod: 'pickup' | 'delivery';
  notes?: string;
  recipients: string[];
  items: PartyHireOrderItem[];
  totals: {
    subtotal: number;
    gst: number;
    total: number;
  };
  status: PartyHireOrderStatus;
  calendarEvent: PartyHireCalendarEvent;
  createdAt: string;
  returnedItems?: Record<number, number>;
}

export interface NewPartyHireOrder {
  customerName: string;
  contactEmail: string;
  contactPhone?: string;
  eventName: string;
  startDate: string;
  endDate: string;
  location: string;
  deliveryMethod: 'pickup' | 'delivery';
  notes?: string;
  recipients: string[];
  items: { stockId: number; quantity: number }[];
}
