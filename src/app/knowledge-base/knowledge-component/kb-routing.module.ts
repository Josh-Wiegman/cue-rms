import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { KbListComponent } from './kb-list/kb-list.component';
import { KbArticleComponent } from './kb-article/kb-article.component';
import { KbSubmitArticleComponent } from './kb-submit-article/kb-submit-article.component';

const routes: Routes = [
  { path: '', component: KbListComponent },
  { path: 'article/:id', component: KbArticleComponent },
  {
    path: 'submit-article',
    component: KbSubmitArticleComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class KbRoutingModule {}
