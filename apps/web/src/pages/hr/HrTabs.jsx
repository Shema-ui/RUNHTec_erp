import React from 'react';
import { NavLink } from 'react-router-dom';
import { Info } from 'lucide-react';
import { ENGAGEMENT_MODEL } from '@/lib/hr';

const TABS = [
  { to: '/hr', label: 'Overview', end: true },
  { to: '/hr/applications', label: 'Applications' },
  { to: '/hr/contractors', label: 'Contractor register' },
  { to: '/hr/engagements', label: 'Project engagements' },
];

export default function HrTabs({ showModel = false }) {
  return (
    <div className="mb-5 space-y-3">
      <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1 shadow-sm" aria-label="HR sections">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      {showModel && (
        <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p><strong>Engagement model: contract per project.</strong> {ENGAGEMENT_MODEL}</p>
        </div>
      )}
    </div>
  );
}
