// src/app/services/database-functions.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { Article } from '../../knowledge-base/knowledge-component/models/article.model';

@Injectable({
  providedIn: 'root',
})
export class dbFunctionsService {
  constructor(private supabaseService: SupabaseService) {}

  async getLocations() {
    try {
      const { data, error } =
        await this.supabaseService.client.functions.invoke('db_get_functions', {
          headers: { 'x-query-type': 'locations' },
        });

      if (error) throw error;
      return data.data;
    } catch (err) {
      console.error('Error fetching functions:', err);
      throw err;
    }
  }

  async getJobsByDate(date: string) {
    try {
      const { data, error } =
        await this.supabaseService.client.functions.invoke('db_get_functions', {
          headers: { 'x-query-type': 'jobs-by-date', 'x-query-date': date },
        });

      if (error) throw error;
      return data.data;
    } catch (err) {
      console.error('Error fetching functions:', err);
      throw err;
    }
  }

  async getArticles() {
    try {
      const { data, error } =
        await this.supabaseService.client.functions.invoke('db_get_functions', {
          headers: { 'x-query-type': 'articles' },
        });

      if (error) throw error;
      return data.data;
    } catch (err) {
      console.error('Error fetching functions:', err);
      throw err;
    }
  }

  async getArticleById(id: string) {
    try {
      const { data, error } =
        await this.supabaseService.client.functions.invoke('db_get_functions', {
          headers: { 'x-query-type': 'articles', 'x-query-id': id },
        });

      if (error) throw error;
      return data.data;
    } catch (err) {
      console.error('Error fetching functions:', err);
      throw err;
    }
  }

  async addArticle(article: Article) {
    try {
      const { data, error } =
        await this.supabaseService.client.functions.invoke('add-article', {
          // ✅ Just pass the article as the body
          body: article,
        });

      if (error) throw error;
      // If your Edge function returns { success: true } or { data: ... }
      return data ?? null;
    } catch (err) {
      console.error('Error adding article:', err);
      throw err;
    }
  }
}
