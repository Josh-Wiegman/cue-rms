import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiShellComponent } from '../shared/ui-shell/ui-shell-component';
import { CustomersService, CustomerRecord } from './customers.service';

@Component({
  selector: 'customers-component',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UiShellComponent],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.scss',
})
export class CustomersComponent {
  searchTerm = '';
  constructor(private readonly customersService: CustomersService) {}

  get customers(): CustomerRecord[] {
    const term = this.searchTerm.toLowerCase();
    return this.customersService
      .list()
      .filter((customer) =>
        term
          ? customer.name.toLowerCase().includes(term) ||
            customer.email.toLowerCase().includes(term)
          : true,
      );
  }
}
