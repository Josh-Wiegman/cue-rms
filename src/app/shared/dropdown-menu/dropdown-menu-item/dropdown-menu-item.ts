import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'cg-dropdown-menu-item',
  imports: [],
  templateUrl: './dropdown-menu-item.html',
  styleUrl: './dropdown-menu-item.scss',
})
export class DropdownMenuItem {
  @Input()
  routerLink?: string;
  @Output()
  onClick = new EventEmitter<void>();
  @Input()
  disabled?: boolean;

  constructor(private router: Router) {}

  handleClick() {
    if (this.disabled) return;

    this.onClick?.emit();

    if (this.routerLink) {
      this.router.navigate([this.routerLink]);
    }
  }
}
