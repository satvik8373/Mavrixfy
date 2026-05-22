import { useEffect, useReducer } from 'react';
import { getIdTokenResult } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

import { useAuth } from '@/contexts/AuthContext';
import { auth, db } from '@/lib/firebase';

import { ROLE_PERMISSION_MAP } from '../mock-data';
import type { AdminPermission, AdminRole, AdminSession } from '../types';

const ADMIN_PREVIEW_KEY = 'mavrixfy_admin_preview';
const VALID_ROLES = new Set<AdminRole>(['super_admin', 'content_editor', 'moderator', 'analyst']);
const VALID_PERMISSIONS = new Set<AdminPermission>(
  Object.values(ROLE_PERMISSION_MAP).flatMap((permissions) => permissions)
);

const asRole = (value: unknown): AdminRole | null => {
  if (typeof value !== 'string') return null;
  return VALID_ROLES.has(value as AdminRole) ? (value as AdminRole) : null;
};

const asPermissions = (value: unknown): AdminPermission[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is AdminPermission => (
    typeof entry === 'string' && VALID_PERMISSIONS.has(entry as AdminPermission)
  ));
};

const getPreviewSession = (): AdminSession | null => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const previewParam = params.get('admin-preview');

    if (previewParam === '1') {
      window.localStorage.setItem(ADMIN_PREVIEW_KEY, '1');
    }

    if (previewParam === '0') {
      window.localStorage.removeItem(ADMIN_PREVIEW_KEY);
    }

    if (window.localStorage.getItem(ADMIN_PREVIEW_KEY) !== '1') return null;

    return {
      status: 'granted',
      role: 'super_admin',
      permissions: ROLE_PERMISSION_MAP.super_admin,
      source: 'preview',
      preview: true,
      name: 'Local Preview Operator',
      email: 'preview@mavrixfy.local',
      uid: 'preview-admin',
    };
  } catch {
    return null;
  }
};

const signedOutSession = (): AdminSession => ({
  status: 'signed_out',
  role: null,
  permissions: [],
  source: 'none',
  preview: false,
  name: '',
  email: '',
  uid: null,
});

export const useAdminAccess = (): AdminSession => {
  const { user, loading, isAuthenticated } = useAuth();
  const [session, dispatchSession] = useReducer<React.Reducer<AdminSession, AdminSession | { status: 'checking' }>, AdminSession>(
    (currentSession, nextSession) => {
      if ('status' in nextSession && nextSession.status === 'checking' && !('role' in nextSession)) {
        return {
          ...currentSession,
          status: 'checking',
          preview: false,
        };
      }
      return nextSession as AdminSession;
    },
    {
      status: 'checking',
      role: null,
      permissions: [],
      source: 'none',
      preview: false,
      name: '',
      email: '',
      uid: null,
    },
    (initial) => getPreviewSession() ?? initial
  );

  useEffect(() => {
    const previewSession = getPreviewSession();
    if (previewSession) {
      dispatchSession(previewSession);
      return;
    }

    if (loading) {
      dispatchSession({ status: 'checking' });
      return;
    }

    if (!isAuthenticated || !user?.id) {
      dispatchSession(signedOutSession());
      return;
    }

    let cancelled = false;

    const evaluateAdminAccess = async () => {
      const firebaseUser = auth.currentUser;
      let claimRole: AdminRole | null = null;
      let docRole: AdminRole | null = null;
      let docPermissions: AdminPermission[] = [];
      let docStatus = 'active';
      let adminDocumentExists = false;

      if (firebaseUser) {
        try {
          const idToken = await getIdTokenResult(firebaseUser);
          const tokenRole = asRole(idToken.claims.role);
          if (idToken.claims.admin === true) {
            claimRole = tokenRole ?? 'super_admin';
          }
        } catch {
          claimRole = null;
        }
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', user.id));
        if (adminSnap.exists()) {
          adminDocumentExists = true;
          const data = adminSnap.data();
          docRole = asRole(data.role) ?? claimRole ?? 'super_admin';
          docPermissions = asPermissions(data.permissions);
          docStatus = typeof data.status === 'string' ? data.status : 'active';
        }
      } catch {
        adminDocumentExists = false;
      }

      const resolvedRole = docRole ?? claimRole;

      if (!resolvedRole && !adminDocumentExists) {
        if (!cancelled) {
          dispatchSession({
            status: 'denied',
            role: null,
            permissions: [],
            source: 'none',
            preview: false,
            name: user.name,
            email: user.email,
            uid: user.id,
            denialReason: 'No admin claim or `admins/{uid}` document was found for this account.',
          });
        }
        return;
      }

      if (docStatus === 'disabled' || docStatus === 'revoked') {
        if (!cancelled) {
          dispatchSession({
            status: 'denied',
            role: resolvedRole,
            permissions: [],
            source: adminDocumentExists ? 'document' : 'claims',
            preview: false,
            name: user.name,
            email: user.email,
            uid: user.id,
            denialReason: 'This admin account is marked as disabled in Firestore.',
          });
        }
        return;
      }

      const permissions = docPermissions.length > 0
        ? docPermissions
        : ROLE_PERMISSION_MAP[resolvedRole ?? 'super_admin'];

      if (!cancelled) {
        dispatchSession({
          status: 'granted',
          role: resolvedRole,
          permissions,
          source: adminDocumentExists ? 'document' : 'claims',
          preview: false,
          name: user.name,
          email: user.email,
          uid: user.id,
        });
      }
    };

    void evaluateAdminAccess();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loading, user?.email, user?.id, user?.name]);

  return session;
};
