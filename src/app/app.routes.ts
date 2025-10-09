import { Routes } from '@angular/router';
import { HomeComponent } from './home/home-component/home-component';
import { NotFoundComponent } from './shared/not-found-component/not-found-component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    title: 'Cue RMS',
  },
  {
    path: 'home',
    component: HomeComponent,
    title: 'Cue rms',
  },
  {
    path: 'sales',
    loadComponent: () =>
      import('./sales/sales-component/sales-component').then(
        (m) => m.SalesComponent,
      ),
    title: 'Sales | Cue RMS',
  },
  {
    path: 'crew',
    loadComponent: () =>
      import('./crew/crew-component/crew-component').then(
        (m) => m.CrewComponent,
      ),
    title: 'Crew | Cue RMS',
  },
  {
    path: 'crew-schedule',
    loadComponent: () =>
      import('./crew/crew-scheduler/crew-scheduler').then(
        (m) => m.CrewScheduler,
      ),
    title: 'Scheduler | Cue RMS',
  },
  {
    path: 'inventory',
    loadComponent: () =>
      import('./inventory/inventory-component/inventory-component').then(
        (m) => m.InventoryComponent,
      ),
    title: 'Inventory | Cue RMS',
  },
  {
    path: 'clashes',
    loadComponent: () =>
      import('./clashes/clashes-component/clashes-component').then(
        (m) => m.ClashesComponent,
      ),
    title: 'Clashes | Cue RMS',
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./calendar/calendar-component/calendar-component').then(
        (m) => m.CalendarComponent,
      ),
    title: 'Calendar | Cue RMS',
  },
  {
    path: 'reporting',
    loadComponent: () =>
      import('./reporting/reporting-component/reporting-component').then(
        (m) => m.ReportingComponent,
      ),
    title: 'Reporting | Cue RMS',
  },
  {
    path: 'kb',
    loadChildren: () =>
      import('./knowledge-base/knowledge-component/knowledge-base.routes').then(
        (m) => m.KnowledgeBaseRoutes,
      ),
    title: 'KBase | Cue RMS',
  },
  {
    path: '**',
    component: NotFoundComponent,
    title: 'Page not found | Cue RMS',
  },
];
