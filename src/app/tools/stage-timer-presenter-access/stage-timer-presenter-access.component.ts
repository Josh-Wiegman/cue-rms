import { AsyncPipe, NgFor, NgIf, TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { StageTimer } from '../stage-timer.models';
import { StageTimerService } from '../stage-timer.service';

@Component({
  selector: 'stage-timer-presenter-access',
  standalone: true,
  imports: [AsyncPipe, FormsModule, NgFor, NgIf, TitleCasePipe],
  templateUrl: './stage-timer-presenter-access.component.html',
  styleUrl: './stage-timer-presenter-access.component.scss',
})
export class StageTimerPresenterAccessComponent implements OnInit {
  private readonly stageTimerService = inject(StageTimerService);
  private readonly router = inject(Router);

  protected timers$ = this.stageTimerService.timers$;
  protected codeInput = '';
  protected errorMessage = '';

  async ngOnInit(): Promise<void> {
    await this.stageTimerService.loadTimers();
  }

  protected async submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const code = this.codeInput.trim().toUpperCase();
    if (!code) {
      this.errorMessage = 'Enter a timer code to open the presenter view.';
      return;
    }

    const timer = this.stageTimerService.getTimerByCode(code);
    if (!timer) {
      this.errorMessage =
        'No timer found for that code. Check the code and try again.';
      return;
    }

    this.errorMessage = '';
    await this.router.navigate([
      '/tools',
      'stage-timer',
      'presenter',
      timer.code,
    ]);
  }

  protected async goToDashboard(): Promise<void> {
    await this.router.navigate(['/tools', 'stage-timer']);
  }

  protected async openTimer(timer: StageTimer): Promise<void> {
    await this.router.navigate([
      '/tools',
      'stage-timer',
      'presenter',
      timer.code,
    ]);
  }

  protected trackByTimer(_: number, timer: StageTimer): string {
    return timer.id;
  }
}
