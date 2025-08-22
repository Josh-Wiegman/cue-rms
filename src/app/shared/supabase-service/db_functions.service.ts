// src/app/services/database-functions.service.ts
import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

@Injectable({
  providedIn: 'root',
})
export class dbFunctionsService {
  constructor(private supabaseService: SupabaseService) {}

  async getFunctions() {
    try {
      const { data, error } =
        await this.supabaseService.client.functions.invoke('db_get_functions', {
          body: { name: 'Functions' },
        });

      if (error) throw error;
      return data.data;
    } catch (err) {
      console.error('Error fetching functions:', err);
      throw err;
    }
  }
}
