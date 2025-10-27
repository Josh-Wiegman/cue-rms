import {
  AsyncPipe,
  CommonModule,
  DatePipe,
  NgFor,
  NgIf,
} from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { combineLatest, map } from 'rxjs';
import { KbService } from '../kb.service';
import { Article } from '../models/article.model';
import { KnowledgeFolder } from '../models/folder.model';
import { KnowledgeViewMode } from '../models/view-mode.type';

@Component({
  selector: 'app-kb-list',
  standalone: true,
  imports: [CommonModule, RouterModule, AsyncPipe, NgIf, NgFor, DatePipe],
  templateUrl: './kb-list.component.html',
  styleUrls: ['./kb-list.component.scss'],
})
export class KbListComponent {
  private readonly kb = inject(KbService);

  readonly articles$ = this.kb.list();
  readonly viewMode$ = this.kb.viewModeChanges();
  readonly folders$ = this.kb.listFolders();
  readonly timeline$ = this.kb.buildTimelineGrouping(this.articles$);

  readonly stats$ = combineLatest([this.articles$, this.folders$]).pipe(
    map(([articles, folders]) => ({
      total: articles.length,
      published: articles.filter((a) => a.status === 'published').length,
      drafts: articles.filter((a) => a.status !== 'published').length,
      folders: folders.length,
    })),
  );

  protected trackById(_: number, article: Article) {
    return article.id;
  }

  protected trackByFolder(_: number, folder: KnowledgeFolder) {
    return folder.id;
  }

  setViewMode(mode: KnowledgeViewMode) {
    this.kb.setViewMode(mode);
  }

  toggleFavourite(article: Article, event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.kb
      .toggleFavourite(article.id)
      .subscribe((res) => (article.isFavourite = res.isFavourite));
  }
}
