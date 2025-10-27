import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { RouterModule } from '@angular/router';
import { map } from 'rxjs';
import { KbService } from '../kb.service';
import { KnowledgeFolder } from '../models/folder.model';
import { AuthService } from '../../../auth/auth.service';
import { PermissionLevel } from '../../../auth/models/permission-level.model';

@Component({
  selector: 'app-kb-sidebar',
  templateUrl: './kb-sidebar.component.html',
  styleUrls: ['./kb-sidebar.component.scss'],
  imports: [RouterModule, CommonModule, AsyncPipe, ReactiveFormsModule],
})
export class KbSidebarComponent {
  private readonly kb = inject(KbService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  readonly folders$ = this.kb.listFolders();
  readonly favourites$ = this.kb.favouriteFolders();
  readonly modules$ = this.kb.listTrainingModules();
  readonly canManage$ = this.auth.currentUser$.pipe(
    map((user) =>
      user ? user.permissionLevel <= PermissionLevel.Administrator : false,
    ),
  );

  readonly folderForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    description: [''],
    colour: ['#2f3a4c'],
    icon: ['📁'],
  });

  showFolderForm = false;
  creatingFolder = false;
  creationMessage = '';
  creationError = false;

  selectFolder(folder: KnowledgeFolder) {
    this.kb.updateFilters({ folderId: folder.id });
  }

  toggleFolderForm() {
    this.showFolderForm = !this.showFolderForm;
    this.creationMessage = '';
    this.creationError = false;
    if (this.showFolderForm) {
      this.folderForm.reset({
        name: '',
        description: '',
        colour: '#2f3a4c',
        icon: '📁',
      });
    }
  }

  createFolder() {
    if (this.folderForm.invalid || this.creatingFolder) {
      this.folderForm.markAllAsTouched();
      return;
    }

    this.creatingFolder = true;
    this.creationMessage = '';
    this.creationError = false;

    const value = this.folderForm.value;

    this.kb
      .createFolder({
        name: value.name ?? '',
        description: value.description ?? undefined,
        colour: value.colour ?? undefined,
        icon: value.icon ?? undefined,
      })
      .subscribe({
        next: () => {
          this.creatingFolder = false;
          this.creationMessage = 'Folder created successfully.';
          this.creationError = false;
          this.folderForm.reset({
            name: '',
            description: '',
            colour: '#2f3a4c',
            icon: '📁',
          });
          this.showFolderForm = false;
        },
        error: (error) => {
          console.error('Failed to create knowledge folder', error);
          this.creatingFolder = false;
          this.creationMessage = 'We could not create the folder. Please try again.';
          this.creationError = true;
        },
      });
  }
}
