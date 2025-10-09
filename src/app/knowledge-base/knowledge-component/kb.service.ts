import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Article } from './models/article.model';
import { dbFunctionsService } from '../../shared/supabase-service/db_functions.service';

@Injectable({
  providedIn: 'root',
})
export class KbService {
  constructor(private dbFunctions: dbFunctionsService) {}

  // Get all articles
  list(): Observable<Article[]> {
    // Convert the Promise returned by getArticles() into an Observable
    return from(this.dbFunctions.getArticles()).pipe(
      map((data) => data as Article[]),
    );
  }

  // Get one article by ID
  get(id: string): Observable<Article | undefined> {
    return from(this.dbFunctions.getArticleById(id)).pipe(
      map((data) => data as Article | undefined),
    );
  }

  // Search articles
  search(q: string): Observable<Article[]> {
    if (!q?.trim()) return this.list();
    const term = q.toLowerCase().trim();

    return this.list().pipe(
      map((articles) =>
        articles.filter(
          (a) =>
            a.title.toLowerCase().includes(term) ||
            (a.excerpt ?? '').toLowerCase().includes(term) ||
            a.tags?.some((t) => t.toLowerCase().includes(term)),
        ),
      ),
    );
  }

  // Add a new article
  add(article: Article): Observable<Article> {
    return from(this.dbFunctions.addArticle(article)).pipe(
      map((data) => data as Article),
    );
  }
}
