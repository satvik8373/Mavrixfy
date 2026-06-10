import { DecodedIdToken } from 'firebase-admin/auth';
import { NextRequest } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { AdminPermission, AdminRole, hasPermission, ROLE_PERMISSIONS, getPermissionLabel } from '@/lib/permissions';

export class AdminApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

export interface VerifiedAdminSession {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
  status: 'active' | 'disabled';
  token: DecodedIdToken;
}

function getBearerToken(request: NextRequest): string {
  const header = request.headers.get('authorization') || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    throw new AdminApiError(401, 'Missing admin authorization token.');
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new AdminApiError(401, 'Missing admin authorization token.');
  }

  return token;
}

async function resolveAdminSession(token: DecodedIdToken): Promise<VerifiedAdminSession | null> {
  const uid = token.uid;
  const email = token.email || '';
  const name = typeof token.name === 'string' ? token.name : 'Admin';

  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (userDoc.exists) {
    const userData = userDoc.data() || {};
    if (userData.role === 'admin' || userData.isAdmin === true) {
      const role = (userData.adminRole as AdminRole | undefined) || 'super_admin';
      const permissions = (userData.adminPermissions as AdminPermission[] | undefined) || ROLE_PERMISSIONS[role];

      return {
        uid,
        email: String(userData.email || email),
        name: String(userData.displayName || userData.fullName || name),
        role,
        permissions,
        status: userData.adminStatus === 'disabled' ? 'disabled' : 'active',
        token,
      };
    }
  }

  const adminDoc = await adminDb.collection('admins').doc(uid).get();
  if (adminDoc.exists) {
    const adminData = adminDoc.data() || {};
    const role = (adminData.role as AdminRole | undefined) || 'super_admin';
    const permissions = (adminData.permissions as AdminPermission[] | undefined) || ROLE_PERMISSIONS[role];

    return {
      uid,
      email: String(adminData.email || email),
      name: String(adminData.name || name),
      role,
      permissions,
      status: adminData.status === 'disabled' ? 'disabled' : 'active',
      token,
    };
  }

  if (token.admin) {
    const role = (token.role as AdminRole | undefined) || 'super_admin';
    return {
      uid,
      email,
      name,
      role,
      permissions: ROLE_PERMISSIONS[role],
      status: 'active',
      token,
    };
  }

  return null;
}

export async function requireAdminPermission(
  request: NextRequest,
  permission: AdminPermission
): Promise<VerifiedAdminSession> {
  const rawToken = getBearerToken(request);
  let decodedToken: DecodedIdToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(rawToken);
  } catch {
    throw new AdminApiError(401, 'Your admin session has expired. Please sign in again.');
  }

  const session = await resolveAdminSession(decodedToken);
  if (!session) {
    throw new AdminApiError(403, 'Admin access is required for this action.');
  }

  if (session.status !== 'active') {
    throw new AdminApiError(403, 'This admin account is disabled.');
  }

  if (!hasPermission(session.role, session.permissions, permission)) {
    const label = getPermissionLabel(permission);
    throw new AdminApiError(403, `You do not have permission to: ${label}.`);
  }

  return session;
}
