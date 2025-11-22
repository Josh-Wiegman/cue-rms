import { Routes } from '@angular/router';
import { ToolsComponent } from './tools.component';

export const ToolsRoutes: Routes = [
  {
    path: '',
    component: ToolsComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'stage-timer',
      },
      {
        path: 'stage-timer',
        loadComponent: () =>
          import(
            './stage-timer-dashboard/stage-timer-dashboard.component'
          ).then((m) => m.StageTimerDashboardComponent),
      },
      {
        path: 'stage-timer/presenter',
        loadComponent: () =>
          import(
            './stage-timer-presenter-access/stage-timer-presenter-access.component'
          ).then((m) => m.StageTimerPresenterAccessComponent),
      },
      {
        path: 'stage-timer/presenter/:code',
        loadComponent: () =>
          import(
            './stage-timer-presenter/stage-timer-presenter.component'
          ).then((m) => m.StageTimerPresenterComponent),
      },
    ],
  },
];
