import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiShellComponent } from '../shared/ui-shell/ui-shell-component';
import { CustomersService, CustomerRecord } from './customers.service';

@Component({
  selector: 'customer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, UiShellComponent],
  templateUrl: './customer-detail.component.html',
  styleUrl: './customer-detail.component.scss',
})
export class CustomerDetailComponent {
  customer?: CustomerRecord;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly customersService: CustomersService,
  ) {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/customers']);
      return;
    }

    const record = this.customersService.getById(id);
    if (!record) {
      this.router.navigate(['/customers']);
      return;
    }

    this.customer = record;
  }
}
