import { Component } from '@angular/core';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { ProductGridComponent } from '../../shared/product-grid/product-grid-component';

@Component({
  selector: 'inventory-component',
  imports: [UiShellComponent, ProductGridComponent],
  templateUrl: './inventory-component.html',
  styleUrl: './inventory-component.scss',
})
export class InventoryComponent {
  test: string[] = ['a', 'b', 'c', 'd'];
}
