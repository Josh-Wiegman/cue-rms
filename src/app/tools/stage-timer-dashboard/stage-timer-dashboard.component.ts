import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  CreateStageTimerPayload,
  StageTimer,
  StageTimerNote,
  StageTimerStatus,
  StageTimerUrgentNote,
} from '../stage-timer.models';
import { StageTimerService } from '../stage-timer.service';
import { SimpleButton } from '../../shared/simple-button/simple-button';
import { Panel } from '../../shared/panel/panel';
import { Pill, PillState } from '../../shared/pill/pill';
import { mapStatusToPillState } from '../helpers/mapStatusToPillState';

@Component({
  selector: 'stage-timer-dashboard',
  standalone: true,
  imports: [
    AsyncPipe,
    DatePipe,
    FormsModule,
    NgFor,
    NgIf,
    SimpleButton,
    Panel,
    Pill,
  ],
  templateUrl: './stage-timer-dashboard.component.html',
  styleUrl: './stage-timer-dashboard.component.scss',
})
export class StageTimerDashboardComponent implements OnInit, OnDestroy {
  private readonly stageTimerService = inject(StageTimerService);
  private readonly router = inject(Router);
  private subscription?: Subscription;

  protected timers$ = this.stageTimerService.timers$;

  protected selectedTimerId: string | null = null;
  protected selectedTimer: StageTimer | null = null;

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
        this.selectedTimer = null;
        return;
      }

      if (this.selectedTimerId) {
        const existing = timers.find((t) => t.id === this.selectedTimerId);
        if (existing) {
          this.selectedTimer = existing;
          return;
        }
      }

      const first = timers[0];
      this.selectedTimerId = first.id;
      this.selectedTimer = first;
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  protected async createTimer(): Promise<void> {
    const payload: CreateStageTimerPayload = {
      name: this.newTimerName,
      durationMinutes: this.newTimerMinutes,
      durationSeconds: this.newTimerSeconds,
      sceneId: 'master',
    };
    const timer = await this.stageTimerService.createTimer(payload);
    this.selectedTimerId = timer.id;
    this.selectedTimer = timer;
    this.showCreateForm = false;
    this.newTimerName = '';
    this.newTimerMinutes = 5;
    this.newTimerSeconds = 0;
  }

  protected selectTimer(timer: StageTimer): void {
    this.selectedTimerId = timer.id;
    this.selectedTimer = timer;
    this.noteDraft = '';
    this.urgentNoteDraft = '';
  }

  protected toggleTimer(timer: StageTimer): void {
    if (timer.status === 'running') {
      void this.stageTimerService.pauseTimer(timer.id);
    } else if (timer.status === 'completed') {
      void this.stageTimerService.resetTimer(timer.id);
      void this.stageTimerService.startTimer(timer.id);
    } else {
      void this.stageTimerService.startTimer(timer.id);
    }
  }

  protected resetTimer(timer: StageTimer): void {
    void this.stageTimerService.resetTimer(timer.id);
  }

  protected deleteTimer(timer: StageTimer): void {
    void this.stageTimerService.deleteTimer(timer.id);
  }

  protected async addNote(timer: StageTimer): Promise<void> {
    const draft = this.noteDraft.trim();
    if (!draft) return;
    await this.stageTimerService.addNote(timer.id, draft);
    this.noteDraft = '';
  }

  protected async addUrgentNote(timer: StageTimer): Promise<void> {
    const draft = this.urgentNoteDraft.trim();
    if (!draft) return;
    await this.stageTimerService.addUrgentNote(timer.id, draft);
    this.urgentNoteDraft = '';
  }

  protected async clearUrgent(timer: StageTimer): Promise<void> {
    await this.stageTimerService.clearUrgentNote(timer.id);
  }

  protected async openPresenter(timer: StageTimer): Promise<void> {
    await this.router.navigate([
      '/tools',
      'stage-timer',
      'presenter',
      timer.code,
    ]);
  }

  protected async openPresenterAccess(): Promise<void> {
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
  protected mapStatusToPillState(status: StageTimerStatus): PillState {
    return mapStatusToPillState(status);
  }
}
