import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  from,
  map,
  of,
} from 'rxjs';
import {
  Article,
  ArticleAttachment,
  ArticleComment,
  ArticleStatus,
  ArticleWithRelations,
  ArticleQuiz,
} from './models/article.model';
import { KnowledgeFolder } from './models/folder.model';
import {
  AdminDashboardSnapshot,
  QuizAttempt,
  TrainingModule,
  TrainingProgress,
} from './models/training.model';
import { KnowledgeViewMode } from './models/view-mode.type';
import { dbFunctionsService } from '../../shared/supabase-service/db_functions.service';

interface KnowledgeBaseFilters {
  folderId?: string | null;
  tag?: string | null;
  status?: ArticleStatus | 'all';
  favouritesOnly?: boolean;
  term?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class KbService {
  private readonly filters$ = new BehaviorSubject<KnowledgeBaseFilters>({
    status: 'published',
  });
  private readonly viewMode$ = new BehaviorSubject<KnowledgeViewMode>('grid');

  constructor(private dbFunctions: dbFunctionsService) {}

  // region ─── Article Queries ────────────────────────────────────────────────

  list(): Observable<Article[]> {
    return combineLatest([
      from(this.dbFunctions.getArticlesWithMeta()),
      this.filters$,
    ]).pipe(
      map(([articles, filters]) =>
        articles.filter((article) => {
          if (
            filters.status &&
            filters.status !== 'all' &&
            article.status !== filters.status
          ) {
            return false;
          }
          if (filters.folderId && article.folderId !== filters.folderId) {
            return false;
          }
          if (filters.tag && !(article.tags ?? []).includes(filters.tag)) {
            return false;
          }
          if (filters.favouritesOnly && !article.isFavourite) {
            return false;
          }
          if (filters.term) {
            const haystack =
              `${article.title} ${article.excerpt ?? ''} ${(article.tags ?? []).join(' ')}`.toLowerCase();
            if (!haystack.includes(filters.term.toLowerCase())) {
              return false;
            }
          }
          return true;
        }),
      ),
    );
  }

  get(idOrSlug: string): Observable<ArticleWithRelations | undefined> {
    if (!idOrSlug) return of(undefined);
    return from(this.dbFunctions.getArticleDetail(idOrSlug)).pipe(
      map((data) => data ?? undefined),
    );
  }

  search(term: string): Observable<Article[]> {
    return from(this.dbFunctions.searchArticles(term));
  }

  upsertArticle(
    article: Partial<Article> & { id?: string },
  ): Observable<Article> {
    return from(this.dbFunctions.upsertArticle(article)).pipe(
      map((data) => data as Article),
    );
  }

  updateFilters(filters: Partial<KnowledgeBaseFilters>): void {
    this.filters$.next({ ...this.filters$.value, ...filters });
  }

  filtersChanges(): Observable<KnowledgeBaseFilters> {
    return this.filters$.asObservable();
  }

  setViewMode(mode: KnowledgeViewMode): void {
    this.viewMode$.next(mode);
  }

  viewModeChanges(): Observable<KnowledgeViewMode> {
    return this.viewMode$.asObservable();
  }

  addComment(
    articleId: string,
    body: string,
    mentions: string[],
    parentId?: string,
  ): Observable<ArticleComment> {
    return from(
      this.dbFunctions.createArticleComment({
        articleId,
        body,
        mentions,
        parentId,
      }),
    ).pipe(map((data) => data as ArticleComment));
  }

  toggleFavourite(articleId: string): Observable<{ isFavourite: boolean }> {
    return from(this.dbFunctions.toggleFavouriteArticle(articleId));
  }

  acknowledgeArticle(
    articleId: string,
  ): Observable<{ acknowledgedAt: string }> {
    return from(this.dbFunctions.acknowledgeArticle(articleId));
  }

  recordArticleProgress(
    articleId: string,
    completed: boolean,
  ): Observable<void> {
    return from(this.dbFunctions.recordArticleProgress(articleId, completed));
  }

  uploadAttachment(
    articleId: string,
    file: File,
  ): Observable<ArticleAttachment> {
    return from(this.dbFunctions.uploadKnowledgeAttachment(articleId, file));
  }

  // endregion

  // region ─── Folders & Navigation ──────────────────────────────────────────

  listFolders(): Observable<KnowledgeFolder[]> {
    return from(this.dbFunctions.getKnowledgeFolders());
  }

  favouriteFolders(): Observable<KnowledgeFolder[]> {
    return this.listFolders().pipe(
      map((folders) =>
        folders.filter((folder) => (folder.progressPct ?? 0) >= 80),
      ),
    );
  }

  // endregion

  // region ─── Training & Quizzes ────────────────────────────────────────────

  listTrainingModules(): Observable<TrainingModule[]> {
    return from(this.dbFunctions.getTrainingModules());
  }

  getQuiz(quizId: string): Observable<ArticleQuiz | undefined> {
    return from(this.dbFunctions.getQuiz(quizId)).pipe(
      map((data) => data ?? undefined),
    );
  }

  submitQuizAttempt(
    quizId: string,
    responses: Record<string, unknown>,
  ): Observable<QuizAttempt> {
    return from(this.dbFunctions.submitQuizAttempt(quizId, responses));
  }

  getTrainingProgress(userId?: string): Observable<TrainingProgress> {
    return from(this.dbFunctions.getTrainingProgress(userId));
  }

  getAdminSnapshot(): Observable<AdminDashboardSnapshot> {
    return from(this.dbFunctions.getKnowledgeAdminSnapshot());
  }

  releaseArticles(payload: {
    articleIds: string[];
    userIds?: string[];
    teamIds?: string[];
  }): Observable<void> {
    return from(this.dbFunctions.releaseArticles(payload));
  }

  // endregion

  // region ─── Helpers ───────────────────────────────────────────────────────

  buildTimelineGrouping(
    articles$: Observable<Article[]>,
  ): Observable<{ period: string; articles: Article[] }[]> {
    return articles$.pipe(
      map((articles) =>
        Object.entries(
          articles.reduce<Record<string, Article[]>>((acc, article) => {
            const date = new Date(article.createdAt);
            const period = new Intl.DateTimeFormat('en-US', {
              month: 'long',
              year: 'numeric',
            }).format(date);
            acc[period] = acc[period] ?? [];
            acc[period].push(article);
            return acc;
          }, {}),
        )
          .map(([period, list]) => ({ period, articles: list }))
          .sort(
            (a, b) =>
              new Date(b.articles[0].createdAt).getTime() -
              new Date(a.articles[0].createdAt).getTime(),
          ),
      ),
    );
  }

  // endregion
}
