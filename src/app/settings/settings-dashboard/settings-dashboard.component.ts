/* eslint-disable @typescript-eslint/no-unused-vars */
import { CommonModule } from '@angular/common';
import { map } from 'rxjs/operators';
import { Component, OnInit, PLATFORM_ID, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { UiShellComponent } from '../../shared/ui-shell/ui-shell-component';
import { AuthService } from '../../auth/auth.service';
import {
  PERMISSION_LEVELS,
  PermissionLevel,
} from '../../auth/models/permission-level.model';
import {
  OrganisationBranding,
  UserInvitationDetails,
} from '../../auth/models/auth-user.model';
import { OrgBrandingService } from '../../shared/org-branding/org-branding.service';

@Component({
  selector: 'app-settings-dashboard',
  standalone: true,
  imports: [CommonModule, UiShellComponent, ReactiveFormsModule],
  templateUrl: './settings-dashboard.component.html',
  styleUrl: './settings-dashboard.component.scss',
})
export class SettingsDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly orgBrandingService = inject(OrgBrandingService);
  private readonly platformId = inject(PLATFORM_ID);

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
    permissionLevel: [PermissionLevel.Staff, [Validators.required]],
    invitationMessage: [''],
  });

  protected isSavingUser = false;
  protected saveMessage = '';
  protected organisationBranding: OrganisationBranding | null = null;

  async ngOnInit(): Promise<void> {
    this.organisationBranding = await this.orgBrandingService.getBranding(
      this.authService.orgSlug,
    );
  }

  protected switchSection(section: 'profile' | 'add-user'): void {
    this.activeSection = section;
    this.saveMessage = '';
  }

  protected canManageUsers(permissionLevel: PermissionLevel): boolean {
    return this.authService.canManageUsers(permissionLevel);
  }

  protected readonly visiblePermissionLevels$ = this.user$.pipe(
    map((user) =>
      this.permissionLevels.filter((lvl) =>
        this.authService.canGrantLevel(lvl),
      ),
    ),
  );

  protected async createUser(
    _permissionLevelParamIsUnused: PermissionLevel,
  ): Promise<void> {
    if (this.createUserForm.invalid) {
      this.createUserForm.markAllAsTouched();
      return;
    }

    const formValue = this.createUserForm.getRawValue();
    const requestedLevel = formValue.permissionLevel;

    if (!this.authService.canGrantLevel(requestedLevel)) {
      this.saveMessage = 'You do not have permission to assign that level.';
      return;
    }

    this.isSavingUser = true;
    this.saveMessage = '';

    try {
      const invitation = this.buildInvitationDetails(
        formValue.invitationMessage,
      );
      await this.authService.createUser({
        displayName: formValue.displayName,
        email: formValue.email,
        permissionLevel: requestedLevel,
        invitation,
      });
      this.saveMessage = `Invitation email sent to ${formValue.email}.`;
      this.createUserForm.reset({
        displayName: '',
        email: '',
        permissionLevel: PermissionLevel.Staff,
        invitationMessage: '',
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

  private buildInvitationDetails(
    invitationMessage: string,
  ): UserInvitationDetails {
    const organisation: OrganisationBranding = this.organisationBranding ?? {
      name: 'Company Name',
      logoUrl: null,
    };

    const admin = this.authService.currentUser;
    const invitedBy = admin
      ? {
          displayName: admin.displayName,
          email: admin.email,
        }
      : undefined;

    return {
      sendEmail: true,
      organisation,
      resetPasswordRedirect: this.getPasswordResetRedirectUrl(),
      message: invitationMessage?.trim() ? invitationMessage.trim() : undefined,
      invitedBy,
    };
  }

  private getPasswordResetRedirectUrl(): string {
    return 'https://www.cue-rms.com/reset-password';
  }

  async logout(): Promise<void> {
    try {
      await this.authService.logout();
    } catch (err) {
      console.error('Logout failed:', err);
    }
  }
}
