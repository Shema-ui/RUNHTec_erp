import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { canAccessModule, needsProfile, isClient, isVendor } from '@/lib/permissions';
import { staffSignInPath } from '@/lib/staffLink';

// Pages a client login may open: the portal, and the quote/invoice documents it links to.
const CLIENT_PATHS = [/^\/portal(\/|$)/, /^\/quotations\/[^/]+\/view$/, /^\/invoices\/[^/]+\/view$/];
import { Loader2 } from 'lucide-react';

// Shown while the app opens. After a few seconds it explains the wait.
function FullScreenLoader() {
  const [slow, setSlow] = React.useState(false);
  React.useEffect(() => { const t = setTimeout(() => setSlow(true), 3000); return () => clearTimeout(t); }, []);
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      {slow && <p className="max-w-xs text-sm text-muted-foreground">Starting up… This can take up to a minute the first time today. Please be patient.</p>}
    </div>
  );
}

export function RequireAuth({ children }) {
  const { isAuthed, ready, user } = useAuth();
  const location = useLocation();
  if (!ready) return <FullScreenLoader />;
  // A vendor whose sign-in ended goes back to their link, not the staff login.
  if (!isAuthed && /^\/vendor\/?$/.test(location.pathname)) return <Navigate to="/v/expired" replace />;
  // Signed out: client pages go to the client sign-in; staff pages go back to this
  // device's staff link if it has one (otherwise the client page, which reveals nothing).
  if (!isAuthed) return <Navigate to={/^\/portal(\/|$)/.test(location.pathname) ? '/login' : staffSignInPath()} replace state={{ from: location }} />;
  if (isVendor(user)) return /^\/vendor\/?$/.test(location.pathname) ? children : <Navigate to="/vendor" replace />;
  if (isClient(user)) return CLIENT_PATHS.some((re) => re.test(location.pathname)) ? children : <Navigate to="/portal" replace />;
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

// staffPage: on the staff sign-in link, someone signed in as a client (or vendor)
// on this phone is NOT sent away; they can sign in as staff instead.
export function RedirectIfAuthed({ children, staffPage = false }) {
  const { isAuthed, ready, user } = useAuth();
  if (!ready) return <FullScreenLoader />;
  if (isAuthed && staffPage && (isClient(user) || isVendor(user))) return children;
  if (isAuthed) return <Navigate to={isVendor(user) ? '/vendor' : isClient(user) ? '/portal' : needsProfile(user) ? '/my-profile' : '/dashboard'} replace />;
  return children;
}
