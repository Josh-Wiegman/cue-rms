import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { KbListComponent } from './kb-list/kb-list.component';
import { KbArticleComponent } from './kb-article/kb-article.component';
import { KbSubmitArticleComponent } from './kb-submit-article/kb-submit-article.component';
import { KbTrainingComponent } from './kb-training/kb-training.component';
import { KbAdminDashboardComponent } from './kb-admin-dashboard/kb-admin-dashboard.component';

const routes: Routes = [
  { path: '', component: KbListComponent },
  { path: 'article/:id', component: KbArticleComponent },
  {
    path: 'submit-article',
    component: KbSubmitArticleComponent,
  },
  { path: 'training', component: KbTrainingComponent },
  { path: 'admin', component: KbAdminDashboardComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class KbRoutingModule {}
