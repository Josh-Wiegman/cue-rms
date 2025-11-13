import { Component, input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'dropdown-menu-item',
  imports: [],
  templateUrl: './dropdown-menu-item.html',
  styleUrl: './dropdown-menu-item.scss',
})
export class DropdownMenuItem {
  onClick = input();
  routerLink = input<string>();

  constructor(private router: Router) {}

  navigate() {
    if (this.routerLink) {
      this.router.navigate([this.routerLink()]);
    }
  }
}
