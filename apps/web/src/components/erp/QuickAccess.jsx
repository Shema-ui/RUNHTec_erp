import React from 'react';
import { Link } from 'react-router-dom';
import { UserRound } from 'lucide-react';
import { MODULE_NAV, ADMIN_NAV } from '@/config/navigation';
import { canAccessModule } from '@/lib/permissions';

const TINTS = [
  'bg-blue-50 text-blue-700', 'bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-700', 'bg-violet-50 text-violet-700',
  'bg-rose-50 text-rose-700', 'bg-cyan-50 text-cyan-700', 'bg-orange-50 text-orange-700', 'bg-indigo-50 text-indigo-700',
];

export function moduleTiles(user, { includeDashboard = false, includeProfile = true } = {}) {
  const mods = MODULE_NAV.filter((i) => i.to && canAccessModule(user, i.key) && (includeDashboard || i.key !== 'dashboard'));
  const admin = ADMIN_NAV.filter((i) => !i.roles || i.roles.includes(user?.role));
  const tiles = [...mods, ...admin];
  if (includeProfile) tiles.push({ key: 'my-profile', label: 'My profile', icon: UserRound, to: '/my-profile' });
  return tiles;
}

// App-style grid of icons: 4 across on a phone, more on wider screens.
export default function QuickAccess({ user, title = 'Quick access', className = '', onNavigate, includeDashboard = false, cols = 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8' }) {
  const tiles = moduleTiles(user, { includeDashboard });
  return (
    <section className={className} aria-label={title}>
      {title && <h3 className="mb-3 font-display text-sm font-bold text-foreground">{title}</h3>}
      <div className={`grid gap-x-2 gap-y-4 ${cols}`}>
        {tiles.map((t, i) => {
          const Icon = t.icon;
          return (
            <Link key={t.key} to={t.to} onClick={onNavigate} className="group flex flex-col items-center gap-1.5 text-center">
              <span className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 transition group-active:scale-95 ${TINTS[i % TINTS.length]}`}>
                <Icon className="h-6 w-6" strokeWidth={2} />
              </span>
              <span className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">{t.label}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
