import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PanelLeftClose,
  PanelLeft,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import { useAuth } from '@/context/AuthContext';
import { roleLabel } from '@/lib/permissions';
import { MODULE_NAV, ADMIN_NAV } from '@/config/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

function NavItem({ item, collapsed }) {
  const Icon = item.icon;
  const inner = (isActive) => (
    <>
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {!collapsed && !item.to && (
        <span className="ml-auto rounded-full bg-secondary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
          Soon
        </span>
      )}
    </>
  );

  const baseCls =
    'group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors';

  if (!item.to) {
    return (
      <div
        className={`${baseCls} cursor-default text-muted-foreground/70 hover:bg-secondary/60`}
        title={collapsed ? item.label : undefined}
      >
        {inner(false)}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `${baseCls} ${
          isActive
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-slate-600 hover:bg-secondary hover:text-foreground'
        }`
      }
    >
      {({ isActive }) => inner(isActive)}
    </NavLink>
  );
}

function SidebarContent({ collapsed, user }) {
  const adminItems = ADMIN_NAV.filter((i) => !i.roles || i.roles.includes(user?.role));
  return (
    <nav className="portal-scroll flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {!collapsed && (
        <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
          Modules
        </p>
      )}
      {MODULE_NAV.map((item) => (
        <NavItem key={item.key} item={item} collapsed={collapsed} />
      ))}

      {adminItems.length > 0 && (
        <>
          <div className="my-3 border-t border-border" />
          {!collapsed && (
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
              Administration
            </p>
          )}
          {adminItems.map((item) => (
            <NavItem key={item.key} item={item} collapsed={collapsed} />
          ))}
        </>
      )}
    </nav>
  );
}

export default function PortalLayout({ children, title, subtitle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = (user?.name || user?.email || 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] bg-background">
      {/* Desktop sidebar */}
      <aside
        className={`sticky top-0 hidden h-[100dvh] shrink-0 flex-col border-r border-border transition-[width] duration-200 md:flex ${
          collapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
      >
        <div className="flex h-16 items-center border-b border-white/10 px-4" style={{ background: '#003DA5' }}>
          <BrandMark collapsed={collapsed} />
        </div>
        <SidebarContent collapsed={collapsed} user={user} />
        <div className="border-t border-border p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            {collapsed ? <PanelLeft className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-border md:hidden" style={{ background: '#fafbfc' }}
            >
              <div className="flex h-16 items-center justify-between border-b border-white/10 px-4" style={{ background: '#003DA5' }}>
                <BrandMark />
                <button onClick={() => setMobileOpen(false)} className="rounded-md p-1.5 text-white/70 hover:bg-white/10">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div onClick={() => setMobileOpen(false)}>
                <SidebarContent collapsed={false} user={user} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-card/90 px-4 backdrop-blur md:px-6">
          <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 hover:bg-secondary md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display truncate text-[15px] font-bold text-foreground md:text-base">
              {title}
            </h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>

          <div className="ml-auto flex items-center gap-1.5 md:gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <button className="relative rounded-md p-2 text-slate-500 transition-colors hover:bg-secondary hover:text-foreground">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-card" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Notifications</p>
                  <p className="text-xs text-muted-foreground">System alerts will appear here</p>
                </div>
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <Bell className="mb-2 h-6 w-6 text-muted-foreground/50" />
                  <p className="text-sm font-medium text-foreground">You are all caught up</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Notifications from future modules will surface in this panel.
                  </p>
                </div>
              </PopoverContent>
            </Popover>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-secondary">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {initials}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block max-w-[140px] truncate text-[13px] font-semibold text-foreground">
                      {user?.name || user?.email}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">{roleLabel(user?.role)}</span>
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <p className="truncate text-sm">{user?.name || 'Account'}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="portal-scroll flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
