export type AdminRole = 'super_admin' | 'content_editor' | 'moderator' | 'analyst';

export type AdminPermission =
  | 'overview.view'
  | 'catalog.manage'
  | 'playlists.manage'
  | 'artists.manage'
  | 'discovery.manage'
  | 'home_video.manage'
  | 'moderation.manage'
  | 'users.manage'
  | 'analytics.view'
  | 'flags.manage'
  | 'promotions.manage'
  | 'notifications.manage'
  | 'roles.manage';

export const ROLE_PERMISSIONS: Record<AdminRole, AdminPermission[]> = {
  super_admin: [
    'overview.view',
    'catalog.manage',
    'playlists.manage',
    'artists.manage',
    'discovery.manage',
    'home_video.manage',
    'moderation.manage',
    'users.manage',
    'analytics.view',
    'flags.manage',
    'promotions.manage',
    'notifications.manage',
    'roles.manage',
  ],
  content_editor: [
    'overview.view',
    'catalog.manage',
    'playlists.manage',
    'artists.manage',
    'home_video.manage',
    'analytics.view',
  ],
  moderator: [
    'overview.view',
    'moderation.manage',
    'users.manage',
    'analytics.view',
  ],
  analyst: [
    'overview.view',
    'analytics.view',
  ],
};

export function hasPermission(
  role: AdminRole | null,
  permissions: AdminPermission[],
  required: AdminPermission
): boolean {
  if (role === 'super_admin') return true;
  return permissions.includes(required);
}

export function getRoleLabel(role: AdminRole): string {
  const labels: Record<AdminRole, string> = {
    super_admin: 'Super Admin',
    content_editor: 'Content Editor',
    moderator: 'Moderator',
    analyst: 'Analyst',
  };
  return labels[role];
}

export function getPermissionLabel(permission: AdminPermission): string {
  const labels: Record<AdminPermission, string> = {
    'overview.view': 'View Overview',
    'catalog.manage': 'Manage Catalog',
    'playlists.manage': 'Manage Playlists',
    'artists.manage': 'Manage Artists',
    'discovery.manage': 'Manage Discovery',
    'home_video.manage': 'Manage Home Video',
    'moderation.manage': 'Manage Moderation',
    'users.manage': 'Manage Users',
    'analytics.view': 'View Analytics',
    'flags.manage': 'Manage Feature Flags',
    'promotions.manage': 'Manage Promotions',
    'notifications.manage': 'Manage Notifications',
    'roles.manage': 'Manage Roles',
  };
  return labels[permission];
}
