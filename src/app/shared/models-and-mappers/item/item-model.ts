export type ItemType = 'sales' | 'rental' | 'consumable';
export type ItemMode = 'Bulk' | 'Serialised';
export type TestInterval = 3 | 6 | 12 | 24;

export interface WarehouseQuantity {
  warehouse: string;
  quantity: number;
}

export interface ItemPricing {
  oneDay: number;
  threeDay: number;
  week: number;
}

export interface ItemBooking {
  orderId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  type: ItemType;
}

export interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  quantity: number;
  quantityAvailable: number;
  unitDayRate: number;
  itemType: ItemType;
  itemMode: ItemMode;
  pricing: ItemPricing;
  productCost: number;
  subhireCost: number;
  weightKg?: number;
  dimensionsMm?: string;
  roadcaseSize?:
    | '400'
    | '600'
    | '800'
    | '1200'
    | '1400'
    | '1600'
    | '1800'
    | 'Cable or Small Item';
  roadcaseQuantity?: number;
  lastTested?: string;
  nextTestDueMonths?: TestInterval;
  imageUrl?: string;
  accessories?: string[];
  accessoryTo?: string[];
  relatedSalesOrders?: string[];
  relatedRepairOrders?: string[];
  relatedTransferOrders?: string[];
  warehouseQuantities: WarehouseQuantity[];
  availabilityBookings?: ItemBooking[];
}
