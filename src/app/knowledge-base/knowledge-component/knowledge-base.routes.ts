import { Routes } from '@angular/router';
import { KbListComponent } from './kb-list/kb-list.component';
import { KbArticleComponent } from './kb-article/kb-article.component';
import { KnowledgeShellComponent } from './kb-shell/knowledge-shell.component';
import { KbSubmitArticleComponent } from './kb-submit-article/kb-submit-article.component';

export const KnowledgeBaseRoutes: Routes = [
  {
    path: '',
    component: KnowledgeShellComponent,
    children: [
      { path: 'article/:id', component: KbArticleComponent },
      { path: '', component: KbListComponent },
      { path: 'submit-article', component: KbSubmitArticleComponent },
    ],
  },
];
