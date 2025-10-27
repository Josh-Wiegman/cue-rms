import {
  AsyncPipe,
  CommonModule,
  DatePipe,
  NgFor,
  NgIf,
} from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { KbService } from '../kb.service';
import { TrainingModule } from '../models/training.model';

@Component({
  selector: 'app-kb-training',
  standalone: true,
  templateUrl: './kb-training.component.html',
  styleUrls: ['./kb-training.component.scss'],
  imports: [CommonModule, AsyncPipe, RouterModule, NgFor, NgIf, DatePipe],
})
export class KbTrainingComponent {
  private readonly kb = inject(KbService);

  readonly modules$ = this.kb.listTrainingModules();
  readonly progress$ = this.kb.getTrainingProgress();

  trackModule(_: number, module: TrainingModule) {
    return module.id;
  }
}
