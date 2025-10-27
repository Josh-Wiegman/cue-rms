import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { KbService } from '../kb.service';
import { KnowledgeFolder } from '../models/folder.model';

@Component({
  selector: 'app-kb-sidebar',
  templateUrl: './kb-sidebar.component.html',
  styleUrls: ['./kb-sidebar.component.scss'],
  imports: [RouterModule, CommonModule, AsyncPipe],
})
export class KbSidebarComponent {
  private readonly kb = inject(KbService);

  readonly folders$ = this.kb.listFolders();
  readonly favourites$ = this.kb.favouriteFolders();
  readonly modules$ = this.kb.listTrainingModules();

  selectFolder(folder: KnowledgeFolder) {
    this.kb.updateFilters({ folderId: folder.id });
  }
}
