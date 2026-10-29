import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Where a notification should take you when clicked.
export function notificationLink(n) {
  if (n.type === 'application') return '/hr/applications';
  if (n.type === 'rfq') return '/rfqs';
  return '/notifications';
}

export function timeAgo(v) {
  const t = new Date(String(v).replace(' ', 'T') + (String(v).includes('Z') ? '' : 'Z')).getTime();
  if (Number.isNaN(t)) return '';
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);

  const load = useCallback(() => {
    if (!user?.id) return;
    pb.collection('notifications').getList(1, 20, { filter: `user = '${user.id}'`, sort: '-created' })
      .then((r) => setItems(r.items || [])).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((n) => !n.read);

  const open = async (n) => {
    if (!n.read) pb.collection('notifications').update(n.id, { read: true }).catch(() => {});
    setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: 1 } : x)));
    navigate(notificationLink(n));
  };

  const markAll = async () => {
    await Promise.all(unread.map((n) => pb.collection('notifications').update(n.id, { read: true }).catch(() => {})));
    setItems((list) => list.map((x) => ({ ...x, read: 1 })));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative rounded-md p-2 text-slate-500 transition-colors hover:bg-secondary hover:text-foreground" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`}>
          <Bell className="h-5 w-5" />
          {unread.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white ring-2 ring-card">
              {unread.length > 9 ? '9+' : unread.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {unread.length > 0 && <button onClick={markAll} className="text-xs font-semibold text-primary">Mark all read</button>}
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">You are all caught up.</div>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.slice(0, 8).map((n) => (
              <li key={n.id}>
                <button onClick={() => open(n)} className={`flex w-full gap-2 px-4 py-3 text-left text-sm hover:bg-secondary ${n.read ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  <span className="min-w-0 flex-1"><span className="line-clamp-2">{n.message}</span><span className="text-[11px] text-muted-foreground">{timeAgo(n.created)}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link to="/notifications" className="block border-t border-border px-4 py-2.5 text-center text-xs font-semibold text-primary hover:bg-secondary">See all</Link>
      </PopoverContent>
    </Popover>
  );
}
