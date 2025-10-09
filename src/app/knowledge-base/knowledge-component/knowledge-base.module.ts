import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { KbListComponent } from './kb-list/kb-list.component';
import { KbArticleComponent } from './kb-article/kb-article.component';
import { KbSearchComponent } from './kb-search/kb-search.component';
import { KbSidebarComponent } from './kb-sidebar/kb-sidebar.component';

import { KbRoutingModule } from './kb-routing.module';
import { KbService } from './kb.service';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    KbRoutingModule,
    KbListComponent,
    KbArticleComponent,
    KbSearchComponent,
    KbSidebarComponent,
  ],
  providers: [KbService],
})
export class KnowledgeBaseModule {}
