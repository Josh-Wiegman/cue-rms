import { Routes } from '@angular/router';
import { HomeComponent } from './home/home-component/home-component';
import { NotFoundComponent } from './shared/not-found-component/not-found-component';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
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
    path: 'home',
    component: HomeComponent,
    title: 'Cue RMS',
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
    path: 'crew',
    loadComponent: () =>
      import('./crew/crew-component/crew-component').then(
        (m) => m.CrewComponent,
      ),
    title: 'Crew | Cue RMS',
    canActivate: [authGuard],
  },
  {
    path: 'crew-schedule',
    loadComponent: () =>
      import('./crew/crew-scheduler/crew-scheduler').then(
        (m) => m.CrewScheduler,
      ),
    title: 'Scheduler | Cue RMS',
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
    path: 'reporting',
    loadComponent: () =>
      import('./reporting/reporting-component/reporting-component').then(
        (m) => m.ReportingComponent,
      ),
    title: 'Reporting | Cue RMS',
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
    path: '**',
    component: NotFoundComponent,
    title: 'Page not found | Cue RMS',
  },
];
