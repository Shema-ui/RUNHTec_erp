import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canAccessModule, needsProfile } from '@/lib/permissions';
import { Loader2 } from 'lucide-react';

function FullScreenLoader() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

export function RequireAuth({ children }) {
  const { isAuthed, ready, user } = useAuth();
  const location = useLocation();
  if (!ready) return <FullScreenLoader />;
  if (!isAuthed) return <Navigate to="/login" replace state={{ from: location }} />;
  // First thing a new staff member sees: their profile. Everything else opens once it's done.
  if (needsProfile(user) && location.pathname !== '/my-profile') return <Navigate to="/my-profile" replace />;
  return children;
}

export function RequireRole({ roles, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <FullScreenLoader />;
  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Gates a route by the same MODULE_ACCESS map that drives sidebar
// visibility, so a role can't reach a module by typing its URL directly
// even though it's hidden from navigation.
export function RequireModule({ moduleKey, children }) {
  const { user, ready } = useAuth();
  if (!ready) return <FullScreenLoader />;
  if (!canAccessModule(user, moduleKey)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export function RedirectIfAuthed({ children }) {
  const { isAuthed, ready, user } = useAuth();
  if (!ready) return <FullScreenLoader />;
  if (isAuthed) return <Navigate to={needsProfile(user) ? '/my-profile' : '/dashboard'} replace />;
  return children;
}
