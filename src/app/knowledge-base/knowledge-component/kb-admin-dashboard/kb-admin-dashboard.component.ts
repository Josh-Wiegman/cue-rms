import { AsyncPipe, CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { KbService } from '../kb.service';

@Component({
  selector: 'app-kb-admin-dashboard',
  standalone: true,
  templateUrl: './kb-admin-dashboard.component.html',
  styleUrls: ['./kb-admin-dashboard.component.scss'],
  imports: [CommonModule, AsyncPipe, RouterModule, DatePipe, NgFor, NgIf],
})
export class KbAdminDashboardComponent {
  private readonly kb = inject(KbService);
  readonly snapshot$ = this.kb.getAdminSnapshot();
}
