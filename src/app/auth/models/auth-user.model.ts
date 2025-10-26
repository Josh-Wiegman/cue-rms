import { PermissionLevel } from './permission-level.model';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  permissionLevel: PermissionLevel;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
  permissionLevel: PermissionLevel;
}
