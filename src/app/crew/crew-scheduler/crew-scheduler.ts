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
  currentView: 'week' | 'day' = 'week';
  selectedDate: string | null = null;

  weekOffset = 0; // 0 = this week, -1 = last week, +1 = next week, etc.
  groupedJobs: { start_date: string; jobs: any[] }[] = [];
  weekRange!: { start: Date; end: Date };

  // inject the service
  constructor(private dbFunctions: dbFunctionsService) {}

  jobsForDate(date: string) {
    return this.jobs.filter((job: { start_date: string | number | Date }) => {
      const d1 = new Date(job.start_date).toDateString();
      const d2 = new Date(date).toDateString();
      return d1 === d2;
    });
  }

  async ngOnInit() {
    await this.loadJobs();
    this.loadWeek();
  }

  async loadJobs() {
    this.jobs = await this.dbFunctions.getJobsByDate('01-01-2026');
    console.log('Jobs loaded:', this.jobs);
  }

  getWeekRange(baseDate: Date) {
    const start = new Date(baseDate);
    const day = start.getDay(); // Sunday=0 … Saturday=6
    const diff = (day === 0 ? -6 : 1) - day; // adjust to Monday
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  loadWeek() {
    const today = new Date();
    const baseDate = new Date(today);
    baseDate.setDate(today.getDate() + this.weekOffset * 7);

    this.weekRange = this.getWeekRange(baseDate);

    // Filter jobs for this week
    const weeklyJobs = this.jobs.filter(
      (job: { start_date: string | number | Date }) => {
        const d = new Date(job.start_date);
        return d >= this.weekRange.start && d <= this.weekRange.end;
      },
    );

    // Group jobs by date
    const grouped: { [key: string]: any[] } = {};
    for (const job of weeklyJobs) {
      const key = new Date(job.start_date).toDateString();
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(job);
    }

    this.groupedJobs = Object.keys(grouped).map((date) => ({
      start_date: date,
      jobs: grouped[date],
    }));
  }

  prevWeek() {
    this.weekOffset--;
    this.loadWeek();
  }

  nextWeek() {
    this.weekOffset++;
    this.loadWeek();
  }

  typeLabels: { [key: string]: string } = {
    pack_out: 'Pack-out',
    pack_in: 'Pack-in',
    event: 'Operation/Event',
  };
}
