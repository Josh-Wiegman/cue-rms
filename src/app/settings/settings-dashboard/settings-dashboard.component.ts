import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { AuthService } from '../../auth/auth.service';
import {
  PERMISSION_LEVELS,
  PermissionLevel,
} from '../../auth/models/permission-level.model';

@Component({
  selector: 'app-settings-dashboard',
  standalone: true,
  imports: [CommonModule, UiShellComponent, ReactiveFormsModule],
  templateUrl: './settings-dashboard.component.html',
  styleUrl: './settings-dashboard.component.scss',
})
export class SettingsDashboardComponent {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);

  protected readonly user$ = this.authService.currentUser$;
  protected readonly permissionLevels = PERMISSION_LEVELS;
  protected readonly permissionLabels: Record<PermissionLevel, string> = {
    [PermissionLevel.SuperAdmin]: 'Super administrator (Level 1)',
    [PermissionLevel.Administrator]: 'Administrator (Level 3)',
    [PermissionLevel.Manager]: 'Manager (Level 5)',
    [PermissionLevel.Staff]: 'Staff (Level 7)',
    [PermissionLevel.Viewer]: 'Viewer (Level 9)',
  };
  protected activeSection: 'profile' | 'add-user' = 'profile';

  protected readonly createUserForm = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    permissionLevel: [PermissionLevel.Staff, [Validators.required]],
  });

  protected isSavingUser = false;
  protected saveMessage = '';

  protected switchSection(section: 'profile' | 'add-user'): void {
    this.activeSection = section;
    this.saveMessage = '';
  }

  protected canManageUsers(permissionLevel: PermissionLevel): boolean {
    return this.authService.canManageUsers(permissionLevel);
  }

  protected async createUser(permissionLevel: PermissionLevel): Promise<void> {
    if (!this.canManageUsers(permissionLevel) || this.createUserForm.invalid) {
      this.createUserForm.markAllAsTouched();
      return;
    }

    this.isSavingUser = true;
    this.saveMessage = '';

    try {
      const formValue = this.createUserForm.getRawValue();
      await this.authService.createUser({
        displayName: formValue.displayName,
        email: formValue.email,
        password: formValue.password,
        permissionLevel: formValue.permissionLevel,
      });
      this.saveMessage = 'User invitation sent successfully.';
      this.createUserForm.reset({
        displayName: '',
        email: '',
        password: '',
        permissionLevel: PermissionLevel.Staff,
      });
    } catch (error) {
      this.saveMessage =
        error instanceof Error
          ? error.message
          : 'Unable to create the new user.';
    } finally {
      this.isSavingUser = false;
    }
  }
  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }
}
