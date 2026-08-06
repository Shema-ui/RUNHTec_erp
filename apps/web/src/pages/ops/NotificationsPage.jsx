import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Bell } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await pb.collection('notifications').getList(1, 100, { sort: '-created' });
        setNotifications(result.items || []);
      } catch (error) {
        console.error('Notifications load error', error);
      }
    };
    load();
  }, []);
  return (
    <PortalLayout title="Notifications" subtitle="Operational alerts and follow-up channels">
      <Helmet>
        <title>Notifications | RUNHTec Business Portal</title>
        <meta name="description" content="Review automated notifications and their delivery channels." />
      </Helmet>

      <div className="grid gap-4">
        {notifications.map((notice) => (
          <div key={notice.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent p-3 text-primary">
                <Bell className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">{notice.message}</h3>
                <p className="mt-2 text-sm text-muted-foreground">Delivered through {notice.type || 'system'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PortalLayout>
  );
}
