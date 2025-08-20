import { Component } from '@angular/core';
import { SupabaseService } from '../../shared/supabase-service/supabase.service';
import { CommonModule } from '@angular/common';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';

@Component({
  selector: 'home-component',
  imports: [CommonModule, UiShellComponent],
  templateUrl: './home-component.html',
  styleUrl: './home-component.scss',
})
export class HomeComponent {
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
