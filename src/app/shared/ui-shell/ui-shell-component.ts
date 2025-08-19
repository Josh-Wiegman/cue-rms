/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component } from '@angular/core';
import { SupabaseService } from '../../supabase.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'ui-shell',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ui-shell-component.html',
  styleUrl: './ui-shell-component.scss',
})
export class UiShellComponent {
  locations: any[] = []; // this doesn't like being typed as 'any', but it works for now

  constructor(private supabaseService: SupabaseService) {
    this.supabaseService.client
      .from('location_main')
      .select('*')
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching data:', error);
        } else {
          console.log('Fetched:', data); // Logging the fetched data for debugging, probably shouldn't do this in production
          this.locations = data ?? [];
        }
      });
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [UiShellComponent],
  template: `<ui-shell></ui-shell>`,
})
export class AppComponent {}
