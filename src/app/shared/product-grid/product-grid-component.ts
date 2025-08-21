import { Component, Input } from '@angular/core';

@Component({
  selector: 'product-grid-component',
  imports: [],
  templateUrl: './product-grid-component.html',
  styleUrl: './product-grid-component.scss',
})
export class ProductGridComponent {
  @Input({ required: true })
  products!: string[];
}
