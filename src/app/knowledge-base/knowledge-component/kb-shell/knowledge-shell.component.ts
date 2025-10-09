import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { KbSidebarComponent } from '../kb-sidebar/kb-sidebar.component';
import { KbSearchComponent } from '../kb-search/kb-search.component';
import { KbListComponent } from '../kb-list/kb-list.component';
import { KbArticleComponent } from '../kb-article/kb-article.component';

@Component({
  selector: 'app-knowledge-shell',
  standalone: true, // or declare in a module if you’re using NgModule
  imports: [
    CommonModule,
    RouterOutlet,
    KbSidebarComponent,
    KbSearchComponent,
    KbListComponent,
    KbArticleComponent,
  ],
  templateUrl: './knowledge-shell.component.html',
  styleUrls: ['./knowledge-shell.component.scss'],
})
export class KnowledgeShellComponent {}
