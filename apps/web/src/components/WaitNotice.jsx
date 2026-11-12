import React, { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';

// "Please be patient" message shown right under a button while signing in.
// The free server sleeps when nobody uses it, so the first sign-in of the day
// can take up to a minute. Edit the wording below.
export const WAIT_TEXT = {
  title: 'Signing you in…',
  body: 'This can take up to a minute, especially the first time today. Please keep this page open; you don’t need to tap again.',
};

export default function WaitNotice({ active, title = WAIT_TEXT.title, body = WAIT_TEXT.body, className = '' }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) { setSecs(0); return undefined; }
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [active]);
  if (!active) return null;
  return (
    <div role="status" aria-live="polite" className={`mt-3 flex items-start gap-3 rounded-xl bg-amber-50 px-3.5 py-3 text-sm text-amber-900 ${className}`}>
      <Hourglass className="mt-0.5 h-4 w-4 shrink-0 animate-pulse" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}{secs >= 3 ? <span className="ml-1 font-normal tabular-nums text-amber-700">({secs}s)</span> : null}</p>
        <p className="mt-0.5 leading-snug">{body}</p>
      </div>
    </div>
  );
}
