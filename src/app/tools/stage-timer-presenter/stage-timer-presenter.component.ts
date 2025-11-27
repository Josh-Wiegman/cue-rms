import { AsyncPipe, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { map, switchMap, tap } from 'rxjs';
import {
  StageTimer,
  StageTimerNote,
  StageTimerStatus,
  StageTimerUrgentNote,
} from '../stage-timer.models';
import { StageTimerService } from '../stage-timer.service';
import { SimpleButton } from '../../shared/simple-button/simple-button';
import { Pill, PillState } from '../../shared/pill/pill';
import { mapStatusToPillState } from '../helpers/mapStatusToPillState';

@Component({
  selector: 'stage-timer-presenter',
  standalone: true,
  imports: [AsyncPipe, DatePipe, NgFor, NgIf, SimpleButton, Pill],
  templateUrl: './stage-timer-presenter.component.html',
  styleUrl: './stage-timer-presenter.component.scss',
})
export class StageTimerPresenterComponent implements OnInit {
  private readonly stageTimerService = inject(StageTimerService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected code = '';

  protected readonly timer$ = this.route.paramMap.pipe(
    map((params) => (params.get('code') ?? '').toUpperCase()),
    tap((code) => (this.code = code)),
    switchMap((code) => this.stageTimerService.timerByCode$(code)),
  );

  async ngOnInit(): Promise<void> {
    await this.stageTimerService.loadTimers();
  }

  protected formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${this.pad(minutes)}:${this.pad(seconds)}`;
  }

  protected timerProgress(timer: StageTimer): number {
    if (!timer.durationSeconds) return 0;
    const elapsed = timer.durationSeconds - timer.remainingSeconds;
    return Math.min(100, Math.max(0, (elapsed / timer.durationSeconds) * 100));
  }

  protected timerStatus(timer: StageTimer): string {
    const status = timer.status;
    if (status === 'running') return 'Running';
    if (status === 'paused') return 'Paused';
    if (status === 'completed') return 'Completed';
    return 'Idle';
  }

  protected notesFor(timer: StageTimer): StageTimerNote[] {
    return [...timer.notes].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  protected urgentNoteFor(timer: StageTimer): StageTimerUrgentNote | null {
    return timer.urgentNote ?? null;
  }

  protected async acknowledge(timer: StageTimer): Promise<void> {
    await this.stageTimerService.acknowledgeUrgentNote(timer.id);
  }

  protected async goHome(): Promise<void> {
    await this.router.navigate(['/tools', 'stage-timer']);
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  protected mapStatusToPillState(status: StageTimerStatus): PillState {
    return mapStatusToPillState(status);
  }
}
