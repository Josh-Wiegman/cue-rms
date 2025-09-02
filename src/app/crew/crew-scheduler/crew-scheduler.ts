/* eslint-disable @typescript-eslint/no-explicit-any */
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { dbFunctionsService } from '../../shared/supabase-service/db_functions.service';

@Component({
  selector: 'crew-scheduler',
  imports: [CommonModule, FormsModule, UiShellComponent],
  templateUrl: './crew-scheduler.html',
  styleUrl: './crew-scheduler.scss',
})
export class CrewScheduler {
  jobs: any = [];
  vehicles: string[] = ['Cue-Go Van', 'Hiace', '20m3 Truck', 'Regius'];

  // inject the service
  constructor(private dbFunctions: dbFunctionsService) {}

  async ngOnInit() {
    await this.loadJobs();
  }

  async loadJobs() {
    this.jobs = await this.dbFunctions.getJobsByDate('01-01-2026');
    console.log('Jobs loaded:', this.jobs);
  }
}
