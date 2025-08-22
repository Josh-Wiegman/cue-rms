/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { dbFunctionsService } from '../../shared/supabase-service/db_functions.service';

@Component({
  selector: 'home-component',
  imports: [CommonModule, UiShellComponent],
  templateUrl: './home-component.html',
  styleUrl: './home-component.scss',
})
export class HomeComponent implements OnInit {
  locations: any = [];

  // ✅ inject the service
  constructor(private dbFunctions: dbFunctionsService) {}

  async ngOnInit() {
    await this.loadLocations();
  }

  async loadLocations() {
    this.locations = await this.dbFunctions.getFunctions();
    console.log('Locations loaded:', this.locations);
  }
}
