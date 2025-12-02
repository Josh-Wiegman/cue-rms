import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'cue-rms:defaultWarehouse';
  private readonly poPrefixKey = 'cue-rms:po-prefix';

  private readonly defaultWarehouseSubject = new BehaviorSubject<string>(
    this.readDefaultWarehouse(),
  );
  readonly defaultWarehouse$ = this.defaultWarehouseSubject.asObservable();

  private readonly poPrefixSubject = new BehaviorSubject<string>(
    this.readPurchaseOrderPrefix(),
  );
  readonly poPrefix$ = this.poPrefixSubject.asObservable();

  setDefaultWarehouse(warehouse: string) {
    this.defaultWarehouseSubject.next(warehouse);
    this.writeDefaultWarehouse(warehouse);
  }

  getDefaultWarehouse(): string {
    return this.defaultWarehouseSubject.getValue();
  }

  setPurchaseOrderPrefix(prefix: string) {
    const sanitized = prefix?.trim() || 'PO-';
    this.poPrefixSubject.next(sanitized);
    this.writePurchaseOrderPrefix(sanitized);
  }

  getPurchaseOrderPrefix(): string {
    return this.poPrefixSubject.getValue();
  }

  private readDefaultWarehouse(): string {
    if (!isPlatformBrowser(this.platformId)) return '';
    try {
      return localStorage.getItem(this.storageKey) ?? '';
    } catch (err) {
      console.warn('Unable to read default warehouse preference', err);
      return '';
    }
  }

  private writeDefaultWarehouse(warehouse: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.storageKey, warehouse);
    } catch (err) {
      console.warn('Unable to persist default warehouse preference', err);
    }
  }

  private readPurchaseOrderPrefix(): string {
    if (!isPlatformBrowser(this.platformId)) return 'PO-';
    try {
      return localStorage.getItem(this.poPrefixKey) || 'PO-';
    } catch (err) {
      console.warn('Unable to read purchase order prefix preference', err);
      return 'PO-';
    }
  }

  private writePurchaseOrderPrefix(prefix: string) {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(this.poPrefixKey, prefix);
    } catch (err) {
      console.warn('Unable to persist purchase order prefix', err);
    }
  }
}
