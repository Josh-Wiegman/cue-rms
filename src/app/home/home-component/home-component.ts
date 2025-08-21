/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { getFunctions } from '../../shared/supabase-service/get_functions.service';

@Component({
  selector: 'home-component',
  imports: [CommonModule, UiShellComponent],
  templateUrl: './home-component.html',
  styleUrl: './home-component.scss',
})
export class HomeComponent {
  locations: any[] = [];

  constructor() {
    this.loadLocations();
  }
  async loadLocations() {
    this.locations = await getFunctions();
    console.log('Locations loaded:', this.locations);
  }
}
