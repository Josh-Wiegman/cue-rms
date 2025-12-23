import { isPlatformBrowser } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanMatchFn, Routes } from '@angular/router';
import { HomeComponent } from './home/home-component/home-component';
import { NotFoundComponent } from './shared/not-found-component/not-found-component';
import { authGuard } from './auth/auth.guard';

const xmasSubdomainMatcher: CanMatchFn = () => {
  const platformId = inject(PLATFORM_ID);

  if (!isPlatformBrowser(platformId)) return false;

  return window.location.hostname.toLowerCase().includes('xmas.');
};

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canMatch: [xmasSubdomainMatcher],
    redirectTo: 'xmas',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then((m) => m.LoginComponent),
    title: 'Sign in | Cue RMS',
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./auth/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
    title: 'Reset password | Cue RMS',
  },
  {
    path: '',
    component: HomeComponent,
    title: 'Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'xmas',
    loadComponent: () =>
      import('./xmas/xmas.component').then((m) => m.XmasComponent),
    title: 'Merry Christmas | Cue RMS',
  },
  {
    path: 'home',
    component: HomeComponent,
    title: 'Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'sales/:orderNumber',
    loadComponent: () =>
      import('./sales/sales-order-detail/sales-order-detail.component').then(
        (m) => m.SalesOrderDetailComponent,
      ),
    title: 'Sales Order | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'sales',
    loadComponent: () =>
      import('./sales/sales-component/sales-component').then(
        (m) => m.SalesComponent,
      ),
    title: 'Sales | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'customers/:id',
    loadComponent: () =>
      import('./customers/customer-detail.component').then(
        (m) => m.CustomerDetailComponent,
      ),
    title: 'Customer detail | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./customers/customers.component').then(
        (m) => m.CustomersComponent,
      ),
    title: 'Customers | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'partyhire',
    loadComponent: () =>
      import('./partyhire/partyhire-component/partyhire.component').then(
        (m) => m.PartyHireComponent,
      ),
    title: 'PartyHire Orders | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'inventory/:sku/availability',
    loadComponent: () =>
      import(
        './inventory/inventory-availability/inventory-availability.component'
      ).then((m) => m.InventoryAvailabilityComponent),
    title: 'Inventory availability | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'inventory/:sku',
    loadComponent: () =>
      import(
        './inventory/inventory-item-detail/inventory-item-detail.component'
      ).then((m) => m.InventoryItemDetailComponent),
    title: 'Inventory detail | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'inventory',
    loadComponent: () =>
      import('./inventory/inventory-component/inventory-component').then(
        (m) => m.InventoryComponent,
      ),
    title: 'Inventory | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'vehicles',
    loadComponent: () =>
      import(
        './vehicles/vehicle-portal-component/vehicle-portal-component'
      ).then((m) => m.VehiclePortalComponent),
    title: 'Vehicles | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'clashes',
    loadComponent: () =>
      import('./clashes/clashes-component/clashes-component').then(
        (m) => m.ClashesComponent,
      ),
    title: 'Clashes | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./calendar/calendar-component/calendar-component').then(
        (m) => m.CalendarComponent,
      ),
    title: 'Calendar | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'crew-planner',
    loadComponent: () =>
      import('./crew-planner/crew-planner.component').then(
        (m) => m.CrewPlannerComponent,
      ),
    title: 'Crew Planner | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'reporting',
    loadComponent: () =>
      import('./reporting/reporting-component/reporting-component').then(
        (m) => m.ReportingComponent,
      ),
    title: 'Reporting | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'purchase-orders',
    loadComponent: () =>
      import('./purchasing/purchase-orders.component').then(
        (m) => m.PurchaseOrdersComponent,
      ),
    title: 'Purchase Orders | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./settings/settings-dashboard/settings-dashboard.component').then(
        (m) => m.SettingsDashboardComponent,
      ),
    title: 'Settings | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'kb',
    loadChildren: () =>
      import('./knowledge-base/knowledge-component/knowledge-base.routes').then(
        (m) => m.KnowledgeBaseRoutes,
      ),
    title: 'KBase | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'tools',
    loadChildren: () =>
      import('./tools/tools.routes').then((m) => m.ToolsRoutes),
    title: 'Tools | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: '**',
    component: NotFoundComponent,
    title: 'Page not found | Cue RMS',
  },
];
