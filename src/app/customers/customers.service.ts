import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  secondaryPhone?: string;
  billingAddress: string;
  deliveryAddress?: string;
  paymentTerms: string;
  cashCustomer: boolean;
}

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly customersSubject = new BehaviorSubject<CustomerRecord[]>([
    {
      id: 'cust-001',
      name: 'Canterbury Insurance Group',
      email: 'events@cig.nz',
      phone: '+64 3 555 1122',
      secondaryPhone: '+64 27 321 9988',
      billingAddress: '12 Manchester St, Christchurch 8011',
      deliveryAddress: 'Te Pae Convention Centre, Colombo St, Christchurch',
      paymentTerms: '20th of following month',
      cashCustomer: false,
    },
    {
      id: 'cust-002',
      name: 'Southern Summer Events',
      email: 'ops@sse.co.nz',
      phone: '+64 3 555 7788',
      billingAddress: '4 Princes St, Dunedin 9016',
      deliveryAddress: 'Forsyth Barr Stadium, Dunedin',
      paymentTerms: '7 days',
      cashCustomer: true,
    },
    {
      id: 'cust-003',
      name: 'Nelson Arts Collective',
      email: 'hello@nelsonarts.nz',
      phone: '+64 3 555 6677',
      secondaryPhone: '+64 21 204 8899',
      billingAddress: '99 Trafalgar St, Nelson 7010',
      deliveryAddress: '',
      paymentTerms: '30 days',
      cashCustomer: false,
    },
  ]);

  readonly customers$ = this.customersSubject.asObservable();

  list(): CustomerRecord[] {
    return this.customersSubject.getValue();
  }

  getById(id: string): CustomerRecord | undefined {
    return this.list().find((customer) => customer.id === id);
  }
}
