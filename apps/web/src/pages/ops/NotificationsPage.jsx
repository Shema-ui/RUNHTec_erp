import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { useAuth } from '@/context/AuthContext';
import { notificationLink, timeAgo } from '@/components/erp/NotificationBell';
import { Loading, Empty, btnLine } from '@/components/erp/kit';

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    pb.collection('notifications').getList(1, 200, { filter: `user = '${user.id}'`, sort: '-created' })
      .then((r) => setItems(r.items || [])).catch(() => setItems([]));
  }, [user?.id]);

  const unread = (items || []).filter((n) => !n.read);
  const markAll = async () => {
    await Promise.all(unread.map((n) => pb.collection('notifications').update(n.id, { read: true }).catch(() => {})));
    setItems((list) => list.map((x) => ({ ...x, read: 1 })));
  };
  const open = (n) => {
    if (!n.read) pb.collection('notifications').update(n.id, { read: true }).catch(() => {});
    navigate(notificationLink(n));
  };

  return (
    <PortalLayout title="Notifications" subtitle="New website requests, applications and alerts for you">
      <Helmet><title>Notifications | RUNHTec Business Portal</title></Helmet>
      {unread.length > 0 && <div className="mb-4 flex justify-end"><button className={btnLine} onClick={markAll}><CheckCheck className="h-4 w-4" /> Mark all as read</button></div>}
      {!items ? <Loading /> : items.length === 0 ? <Empty>No notifications yet.</Empty> : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
          {items.map((n) => (
            <li key={n.id}>
              <button onClick={() => open(n)} className="flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-secondary/50">
                <span className={`rounded-xl p-2.5 ${n.read ? 'bg-secondary text-muted-foreground' : 'bg-accent text-primary'}`}><Bell className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm ${n.read ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}>{n.message}</span>
                  <span className="text-xs text-muted-foreground">{timeAgo(n.created)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PortalLayout>
  );
}
