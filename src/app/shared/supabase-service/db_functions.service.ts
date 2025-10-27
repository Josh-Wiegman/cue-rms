/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/services/database-functions.service.ts
import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import {
  Article,
  ArticleAttachment,
  ArticleWithRelations,
  ArticleQuiz,
  ArticleComment,
} from '../../knowledge-base/knowledge-component/models/article.model';
import { KnowledgeFolder } from '../../knowledge-base/knowledge-component/models/folder.model';
import { AuthService } from '../../auth/auth.service';
import {
  AdminDashboardSnapshot,
  QuizAttempt,
  TrainingModule,
  TrainingProgress,
} from '../../knowledge-base/knowledge-component/models/training.model';

// Optional: wherever you store org state; adjust to your app.
interface OrgProvider {
  getCurrentOrgSlug(): string | null; // implement this somewhere in your app
}

@Injectable({ providedIn: 'root' })
export class dbFunctionsService {
  private readonly authService = inject(AuthService);
  private readonly supabaseService = inject(SupabaseService);

  // TODO wire this to your real provider (AuthService, OrgBrandingService, etc.)
  private orgProvider: OrgProvider = {
    getCurrentOrgSlug: () => {
      return this.authService.orgSlug;
    },
  };

  private orgHeaders(extra?: Record<string, string>) {
    const headers: Record<string, string> = { ...(extra ?? {}) };
    const slug = this.orgProvider.getCurrentOrgSlug();
    if (slug) headers['x-org-slug'] = slug;
    return headers;
  }

  // ─── Legacy database-access equivalents (now routed to knowledgebase-hub) ──

  async getLocations(): Promise<any[]> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      { headers: this.orgHeaders({ 'x-query-type': 'locations' }) },
    );
    if (error) throw error;
    return data.data as any[];
  }

  async getJobsByDate(date: string): Promise<any[]> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({
          'x-query-type': 'jobs-by-date',
          'x-query-date': date,
        }),
      },
    );
    if (error) throw error;
    return data.data as any[];
  }

  async getNavigationItems(orgSlug: string) {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'navbar-availability',
      {
        headers: {
          'x-query-type': 'navigation-items',
          'x-org-slug': orgSlug,
        },
      },
    );
    if (error) throw error;
    // Edge returns { items: [...] }
    return data.items;
  }

  // ─── Knowledge Base Calls ──────────────────────────────────────────────────

  async getArticlesWithMeta(): Promise<Article[]> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      { headers: this.orgHeaders({ 'x-query-type': 'articles-with-meta' }) },
    );
    if (error) throw error;
    return data.articles as Article[];
  }

  async getArticleDetail(
    idOrSlug: string,
  ): Promise<ArticleWithRelations | null> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({
          'x-query-type': 'article-detail',
          'x-article-id': idOrSlug,
        }),
      },
    );
    if (error) throw error;
    return (data.article ?? null) as ArticleWithRelations | null;
  }

  async searchArticles(term: string): Promise<Article[]> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({ 'x-query-type': 'search-articles' }),
        body: { term },
      },
    );
    if (error) throw error;
    return data.articles as Article[];
  }

  async upsertArticle(
    article: Partial<Article> & { id?: string },
  ): Promise<Article> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({ 'x-query-type': 'upsert-article' }),
        body: { article },
      },
    );
    if (error) throw error;
    return data.article as Article;
  }

  async createArticleComment(payload: {
    articleId: string;
    body: string;
    mentions?: string[];
    parentId?: string;
  }): Promise<ArticleComment> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({ 'x-query-type': 'create-comment' }),
        body: payload,
      },
    );
    if (error) throw error;
    return data.comment as ArticleComment;
  }

  async toggleFavouriteArticle(
    articleId: string,
  ): Promise<{ isFavourite: boolean }> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({
          'x-query-type': 'toggle-favourite',
          'x-article-id': articleId,
        }),
      },
    );
    if (error) throw error;
    return data as { isFavourite: boolean };
  }

  async acknowledgeArticle(
    articleId: string,
  ): Promise<{ acknowledgedAt: string }> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({
          'x-query-type': 'acknowledge-article',
          'x-article-id': articleId,
        }),
      },
    );
    if (error) throw error;
    return data as { acknowledgedAt: string };
  }

  async recordArticleProgress(
    articleId: string,
    completed: boolean,
  ): Promise<void> {
    const { error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({ 'x-query-type': 'record-progress' }),
        body: { articleId, completed },
      },
    );
    if (error) throw error;
  }

  async uploadKnowledgeAttachment(
    articleId: string,
    file: File,
  ): Promise<ArticleAttachment> {
    const form = new FormData();
    form.append('articleId', articleId);
    form.append('file', file);

    // Separate edge function (add CORS there too)
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-attachments',
      { body: form },
    );
    if (error) throw error;
    return data.attachment as ArticleAttachment;
  }

  async getKnowledgeFolders(): Promise<KnowledgeFolder[]> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      { headers: this.orgHeaders({ 'x-query-type': 'folders' }) },
    );
    if (error) throw error;
    return data.folders as KnowledgeFolder[];
  }

  async createKnowledgeFolder(
    folder: Partial<KnowledgeFolder> & { name: string },
  ): Promise<KnowledgeFolder> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({ 'x-query-type': 'upsert-folder' }),
        body: { folder },
      },
    );
    if (error) throw error;
    return data.folder as KnowledgeFolder;
  }

  async getTrainingModules(): Promise<TrainingModule[]> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      { headers: this.orgHeaders({ 'x-query-type': 'training-modules' }) },
    );
    if (error) throw error;
    return data.modules as TrainingModule[];
  }

  async getQuiz(quizId: string): Promise<ArticleQuiz | null> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({
          'x-query-type': 'quiz-detail',
          'x-quiz-id': quizId,
        }),
      },
    );
    if (error) throw error;
    return (data.quiz ?? null) as ArticleQuiz | null;
  }

  async submitQuizAttempt(
    quizId: string,
    responses: Record<string, unknown>,
  ): Promise<QuizAttempt> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({
          'x-query-type': 'submit-quiz',
          'x-quiz-id': quizId,
        }),
        body: { responses },
      },
    );
    if (error) throw error;
    return data.attempt as QuizAttempt;
  }

  async getTrainingProgress(userId?: string): Promise<TrainingProgress> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      { headers: { 'x-query-type': 'training-progress' }, body: { userId } }, // per-user; org not required
    );
    if (error) throw error;
    return data.progress as TrainingProgress;
  }

  async getKnowledgeAdminSnapshot(): Promise<AdminDashboardSnapshot> {
    const { data, error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      { headers: this.orgHeaders({ 'x-query-type': 'admin-snapshot' }) },
    );
    if (error) throw error;
    return data.snapshot as AdminDashboardSnapshot;
  }

  async releaseArticles(payload: {
    articleIds: string[];
    userIds?: string[];
    teamIds?: string[];
  }): Promise<void> {
    const { error } = await this.supabaseService.client.functions.invoke(
      'knowledgebase-hub',
      {
        headers: this.orgHeaders({ 'x-query-type': 'release-articles' }),
        body: payload,
      },
    );
    if (error) throw error;
  }

  // Demo
  getItems() {
    return [
      { id: 1, name: 'test 1', category: 'light', stock: 5, price: 50 },
      { id: 2, name: 'test 2', category: 'speaker', stock: 2, price: 25 },
    ];
  }
}
