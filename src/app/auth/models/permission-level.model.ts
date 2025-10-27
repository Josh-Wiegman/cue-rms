export enum PermissionLevel {
  SuperAdmin = 1,
  Administrator = 3,
  Manager = 5,
  Staff = 7,
  Viewer = 9,
}

export const PERMISSION_LEVELS: PermissionLevel[] = [
  PermissionLevel.SuperAdmin,
  PermissionLevel.Administrator,
  PermissionLevel.Manager,
  PermissionLevel.Staff,
  PermissionLevel.Viewer,
];

export function isPermissionLevel(value: number): value is PermissionLevel {
  return PERMISSION_LEVELS.includes(value as PermissionLevel);
}

export const rankOf = (lvl: PermissionLevel) => Number(lvl);
