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
  test: string[] = [
    'a',
    'b',
    'c',
    'd',
    'e',
    'f',
    'g',
    'h',
    'i',
    'j',
    'k',
    'l',
    'm',
    'n',
    'o',
    'p',
    'q',
    'r',
    's',
    't',
    'u',
    'v',
    'w',
    'x',
    'y',
    'z',
  ];
}
