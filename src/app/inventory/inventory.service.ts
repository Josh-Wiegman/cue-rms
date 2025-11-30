import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { InventoryItem } from '../shared/models-and-mappers/item/item-model';

const initialItems: InventoryItem[] = [
  {
    id: 1,
    sku: '192176',
    name: 'LED Fresnel 300W',
    category: 'Lighting',
    quantity: 18,
    quantityAvailable: 12,
    unitDayRate: 120,
    itemType: 'rental',
    itemMode: 'Serialised',
    pricing: { oneDay: 120, threeDay: 290, week: 480 },
    productCost: 900,
    subhireCost: 75,
    weightKg: 6.2,
    dimensionsMm: '320 x 220 x 180',
    roadcaseSize: '600',
    roadcaseQuantity: 2,
    lastTested: '2024-03-12',
    nextTestDueMonths: 12,
    imageUrl:
      'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=600&q=80',
    accessories: ['Barndoors', 'Powercon to 10A cable'],
    accessoryTo: ['LED Fresnel Diffuser Kit'],
    relatedSalesOrders: ['SO-1004', 'SO-1021'],
    relatedRepairOrders: ['RO-212'],
    relatedTransferOrders: ['TO-14'],
    warehouseQuantities: [
      { warehouse: 'Main Warehouse', quantity: 10 },
      { warehouse: 'Tour Prep', quantity: 6 },
      { warehouse: 'On Truck', quantity: 2 },
    ],
    availabilityBookings: [
      {
        orderId: 'SO-1004',
        startDate: '2024-08-04',
        endDate: '2024-08-07',
        quantity: 4,
        type: 'rental',
      },
      {
        orderId: 'SO-1021',
        startDate: '2024-08-15',
        endDate: '2024-08-23',
        quantity: 6,
        type: 'rental',
      },
    ],
  },
  {
    id: 2,
    sku: '843512',
    name: 'Shure SM58',
    category: 'Audio',
    quantity: 60,
    quantityAvailable: 57,
    unitDayRate: 12,
    itemType: 'rental',
    itemMode: 'Bulk',
    pricing: { oneDay: 12, threeDay: 30, week: 54 },
    productCost: 120,
    subhireCost: 9,
    weightKg: 0.3,
    dimensionsMm: '151 x 51 x 51',
    roadcaseSize: 'Cable or Small Item',
    roadcaseQuantity: 15,
    lastTested: '2024-05-02',
    nextTestDueMonths: 6,
    imageUrl:
      'https://images.unsplash.com/photo-1485579149621-3123dd979885?auto=format&fit=crop&w=600&q=80',
    accessories: ['Foam Windshield'],
    accessoryTo: ['Wireless Beltpack Kit'],
    relatedSalesOrders: ['SO-0999'],
    relatedRepairOrders: [],
    relatedTransferOrders: ['TO-19', 'TO-22'],
    warehouseQuantities: [
      { warehouse: 'Main Warehouse', quantity: 40 },
      { warehouse: 'Festival Site', quantity: 15 },
      { warehouse: 'Dry Hire Counter', quantity: 5 },
    ],
    availabilityBookings: [
      {
        orderId: 'SO-0999',
        startDate: '2024-08-02',
        endDate: '2024-08-05',
        quantity: 12,
        type: 'rental',
      },
    ],
  },
  {
    id: 3,
    sku: '564209',
    name: '12m Truss Length',
    category: 'Rigging',
    quantity: 24,
    quantityAvailable: 22,
    unitDayRate: 55,
    itemType: 'rental',
    itemMode: 'Bulk',
    pricing: { oneDay: 55, threeDay: 130, week: 220 },
    productCost: 430,
    subhireCost: 40,
    weightKg: 18,
    dimensionsMm: '12000 x 300 x 300',
    roadcaseSize: '1800',
    roadcaseQuantity: 4,
    lastTested: '2024-01-18',
    nextTestDueMonths: 24,
    accessories: ['Truss Pin Pack'],
    accessoryTo: [],
    relatedSalesOrders: ['SO-0988'],
    relatedRepairOrders: ['RO-214'],
    relatedTransferOrders: [],
    warehouseQuantities: [
      { warehouse: 'Main Warehouse', quantity: 14 },
      { warehouse: 'Arena Boneyard', quantity: 10 },
    ],
    availabilityBookings: [
      {
        orderId: 'SO-0988',
        startDate: '2024-08-20',
        endDate: '2024-08-28',
        quantity: 8,
        type: 'rental',
      },
    ],
  },
];

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly itemsSubject = new BehaviorSubject<InventoryItem[]>(
    initialItems,
  );
  readonly items$ = this.itemsSubject.asObservable();

  list(): InventoryItem[] {
    return this.itemsSubject.getValue();
  }

  getBySku(sku: string): InventoryItem | undefined {
    return this.itemsSubject.getValue().find((item) => item.sku === sku);
  }

  addItem(newItem: Omit<InventoryItem, 'id' | 'sku'> & { sku?: string }) {
    const items = this.itemsSubject.getValue();
    const nextId = items.length
      ? Math.max(...items.map((item) => item.id)) + 1
      : 1;
    const sku = newItem.sku ?? this.generateSku();
    const itemToInsert: InventoryItem = {
      ...newItem,
      id: nextId,
      sku,
    };

    this.itemsSubject.next([...items, itemToInsert]);
    return itemToInsert;
  }

  updateItem(
    sku: string,
    payload: Partial<Omit<InventoryItem, 'sku' | 'id'>>,
  ): InventoryItem | undefined {
    const items = this.itemsSubject.getValue();
    const index = items.findIndex((item) => item.sku === sku);
    if (index === -1) return undefined;

    const updated: InventoryItem = { ...items[index], ...payload };
    const nextItems = [...items];
    nextItems[index] = updated;
    this.itemsSubject.next(nextItems);
    return updated;
  }

  generateSku(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
  }
}
