'use client';

import { createContext, useContext, useEffect, useState, ReactNode, useMemo, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase-client';
import { AdminSession, AdminRole, AdminPermission } from '@/types';
import { ROLE_PERMISSIONS } from '@/lib/permissions';

interface AuthContextType {
  user: User | null;
  session: AdminSession | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AdminSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        try {
          // First check the main users collection for admin role
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // Check if user has admin role in their profile
            if (userData.role === 'admin' || userData.isAdmin === true) {
              const role: AdminRole = userData.adminRole || 'super_admin';
              const permissions = userData.adminPermissions as AdminPermission[] || ROLE_PERMISSIONS[role];
              
              setSession({
                uid: firebaseUser.uid,
                email: firebaseUser.email || userData.email || '',
                name: firebaseUser.displayName || userData.displayName || userData.fullName || 'Admin',
                role,
                permissions,
                status: 'active',
              });
              setLoading(false);
              return;
            }
          }

          // Fallback: Check dedicated admins collection
          const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));

          if (adminDoc.exists()) {
            const adminData = adminDoc.data();
            const role = adminData.role as AdminRole;
            const permissions = adminData.permissions as AdminPermission[] || ROLE_PERMISSIONS[role];

            setSession({
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || adminData.name || 'Admin',
              role,
              permissions,
              status: adminData.status || 'active',
            });
          } else {
            // Check custom claims
            const idTokenResult = await firebaseUser.getIdTokenResult();
            if (idTokenResult.claims.admin) {
              const role = (idTokenResult.claims.role as AdminRole) || 'super_admin';
              setSession({
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Admin',
                role,
                permissions: ROLE_PERMISSIONS[role],
                status: 'active',
              });
            } else {
              setSession(null);
            }
          }
        } catch (error) {
          console.error('Error fetching admin session:', error);
          setSession(null);
        }
      } else {
        setSession(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
    setSession(null);
  }, []);

  const contextValue = useMemo(() => ({
    user,
    session,
    loading,
    signIn,
    signOut,
  }), [user, session, loading, signIn, signOut]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
