import React from 'react';
import { Lock } from 'lucide-react';

// Shown next to internal-only figures. Projections and estimates are no longer used anywhere.
export function InternalBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
      <Lock className="h-3 w-3" /> Internal — client never sees this
    </span>
  );
}
