import { Component, inject } from '@angular/core';
import { AsyncPipe, CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { KbSidebarComponent } from '../kb-sidebar/kb-sidebar.component';
import { KbSearchComponent } from '../kb-search/kb-search.component';
import { KbListComponent } from '../kb-list/kb-list.component';
import { KbArticleComponent } from '../kb-article/kb-article.component';
import { AuthService } from '../../../auth/auth.service';
import { PermissionLevel } from '../../../auth/models/permission-level.model';

@Component({
  selector: 'app-knowledge-shell',
  standalone: true, // or declare in a module if you’re using NgModule
  imports: [
    CommonModule,
    AsyncPipe,
    RouterOutlet,
    RouterLink,
    KbSidebarComponent,
    KbSearchComponent,
    KbListComponent,
    KbArticleComponent,
  ],
  templateUrl: './knowledge-shell.component.html',
  styleUrls: ['./knowledge-shell.component.scss'],
})
export class KnowledgeShellComponent {
  private readonly auth = inject(AuthService);

  readonly canManage$ = this.auth.currentUser$.pipe(
    map((user) =>
      user ? user.permissionLevel <= PermissionLevel.Administrator : false,
    ),
  );
}
