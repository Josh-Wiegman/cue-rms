import { PermissionLevel } from './permission-level.model';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  permissionLevel: PermissionLevel;
}

export interface OrganisationBranding {
  name: string;
  logoUrl: string | null;
}

export interface UserInvitationDetails {
  sendEmail: boolean;
  message?: string;
  organisation: OrganisationBranding;
  resetPasswordRedirect: string;
  invitedBy?: {
    displayName: string;
    email: string;
  };
}

export interface CreateUserRequest {
  email: string;
  displayName: string;
  permissionLevel: PermissionLevel;
  invitation?: UserInvitationDetails;
}
