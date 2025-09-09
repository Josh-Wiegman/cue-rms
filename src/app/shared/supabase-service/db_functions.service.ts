// src/app/services/database-functions.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

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

  getItems() {
    return [
      { id: 1, name: 'test 1', category: 'light', stock: 5, price: 50 },
      { id: 2, name: 'test 2', category: 'speaker', stock: 2, price: 25 },
    ];
  }
}
