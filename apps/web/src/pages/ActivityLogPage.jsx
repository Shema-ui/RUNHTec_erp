import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { ScrollText, RefreshCw } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { Button } from '@/components/ui/button';

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ActivityLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await pb.collection('activity_logs').getList(1, 100, { sort: '-created' });
      setLogs(res.items);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <PortalLayout title="Activity Logs" subtitle="Audit trail of portal actions">
      <Helmet>
        <title>Activity Logs | RUNHTec Business Portal</title>
        <meta name="description" content="Security audit trail of user actions across the RUNHTec Business Portal. Super Administrator only." />
      </Helmet>

      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Most recent portal activity, newest first.</p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-6 w-full animate-pulse rounded bg-secondary" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <ScrollText className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium text-foreground">No activity recorded yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Actions across the portal will be logged here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {logs.map((log) => (
              <li key={log.id} className="flex items-start gap-4 px-5 py-3.5">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                  <ScrollText className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{log.action}</p>
                  {log.detail && <p className="truncate text-xs text-muted-foreground">{log.detail}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-medium text-foreground">{log.actor_name || 'System'}</p>
                  <p className="text-xs text-muted-foreground">{formatWhen(log.created)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalLayout>
  );
}
