import { AsyncPipe, DatePipe, NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CreateStageTimerPayload,
  StageTimer,
  StageTimerNote,
  StageTimerUrgentNote,
} from '../stage-timer.models';
import { StageTimerService } from '../stage-timer.service';

@Component({
  selector: 'stage-timer-dashboard',
  standalone: true,
  imports: [AsyncPipe, DatePipe, FormsModule, NgClass, NgFor, NgIf, RouterLink],
  templateUrl: './stage-timer-dashboard.component.html',
  styleUrl: './stage-timer-dashboard.component.scss',
})
export class StageTimerDashboardComponent implements OnInit, OnDestroy {
  private readonly stageTimerService = inject(StageTimerService);
  private readonly router = inject(Router);
  private subscription?: Subscription;

  protected timers$ = this.stageTimerService.timers$;
  protected selectedTimerId: string | null = null;
  protected selected: StageTimer | null = null; // component-level selected
  protected showCreateForm = false;
  protected newTimerName = '';
  protected newTimerMinutes = 5;
  protected newTimerSeconds = 0;
  protected noteDraft = '';
  protected urgentNoteDraft = '';

  async ngOnInit(): Promise<void> {
    await this.stageTimerService.loadTimers();
    this.subscription = this.timers$.subscribe((timers) => {
      if (!timers.length) {
        this.selectedTimerId = null;
        this.selected = null;
        return;
      }

      if (this.selectedTimerId) {
        const existing = timers.find(
          (timer) => timer.id === this.selectedTimerId,
        );
        if (existing) {
          this.selected = existing;
          return;
        }
      }

      const first = timers[0] ?? null;
      this.selectedTimerId = first?.id ?? null;
      this.selected = first;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  protected async createTimer(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const payload: CreateStageTimerPayload = {
      name: this.newTimerName,
      durationMinutes: this.newTimerMinutes,
      durationSeconds: this.newTimerSeconds,
      sceneId: 'master',
    };
    const timer = await this.stageTimerService.createTimer(payload);
    this.selectedTimerId = timer.id;
    this.selected = timer;
    this.showCreateForm = false;
    this.newTimerName = '';
    this.newTimerMinutes = 5;
    this.newTimerSeconds = 0;
  }

  protected selectTimer(timer: StageTimer): void {
    this.selectedTimerId = timer.id;
    this.selected = timer;
    this.noteDraft = '';
    this.urgentNoteDraft = '';
  }

  protected toggleTimer(timer: StageTimer, event: Event): void {
    event.stopPropagation();
    if (timer.status === 'running') {
      void this.stageTimerService.pauseTimer(timer.id);
    } else if (timer.status === 'completed') {
      void this.stageTimerService.resetTimer(timer.id);
      void this.stageTimerService.startTimer(timer.id);
    } else {
      void this.stageTimerService.startTimer(timer.id);
    }
  }

  protected resetTimer(timer: StageTimer, event: Event): void {
    event.stopPropagation();
    void this.stageTimerService.resetTimer(timer.id);
  }

  protected deleteTimer(timer: StageTimer, event: Event): void {
    event.stopPropagation();
    void this.stageTimerService.deleteTimer(timer.id);
  }

  protected async addNote(timer: StageTimer): Promise<void> {
    const draft = this.noteDraft.trim();
    if (!draft) return;
    await this.stageTimerService.addNote(timer.id, draft);
    this.noteDraft = '';
  }

  // NOTE: allow null here because the template may pass selected: StageTimer | null
  protected async addUrgentNote(timer: StageTimer | null): Promise<void> {
    const draft = this.urgentNoteDraft.trim();
    if (!draft || !timer) return;
    await this.stageTimerService.addUrgentNote(timer.id, draft);
    this.urgentNoteDraft = '';
  }

  protected async clearUrgent(timer: StageTimer): Promise<void> {
    await this.stageTimerService.clearUrgentNote(timer.id);
  }

  protected async openPresenter(
    timer: StageTimer,
    event: Event,
  ): Promise<void> {
    event.stopPropagation();
    await this.router.navigate([
      '/tools',
      'stage-timer',
      'presenter',
      timer.code,
    ]);
  }

  protected async openPresenterAccess(event: Event): Promise<void> {
    event.preventDefault();
    await this.router.navigate(['/tools', 'stage-timer', 'presenter']);
  }

  protected formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${this.pad(minutes)}:${this.pad(seconds)}`;
  }

  protected timerStatusBadge(timer: StageTimer): string {
    const status = timer.status;
    if (status === 'running') return 'Running';
    if (status === 'paused') return 'Paused';
    if (status === 'completed') return 'Completed';
    return 'Idle';
  }

  protected timerProgress(timer: StageTimer): number {
    if (!timer.durationSeconds) return 0;
    const elapsed = timer.durationSeconds - timer.remainingSeconds;
    return Math.min(100, Math.max(0, (elapsed / timer.durationSeconds) * 100));
  }

  protected isSelected(timer: StageTimer): boolean {
    return timer.id === this.selectedTimerId;
  }

  protected trackByTimer(_: number, timer: StageTimer): string {
    return timer.id;
  }

  protected notesFor(timer: StageTimer): StageTimerNote[] {
    return [...timer.notes].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  protected urgentNoteFor(timer: StageTimer): StageTimerUrgentNote | null {
    return timer.urgentNote ?? null;
  }

  protected toggleCreateForm(): void {
    this.showCreateForm = !this.showCreateForm;
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
