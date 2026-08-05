import pb from '@/lib/pocketbaseClient';

// Fire-and-forget activity logger. Never blocks the UI on failure.
export async function logActivity(action, detail = '') {
  try {
    const actor = pb.authStore.record;
    await pb.collection('activity_logs').create(
      {
        actor: actor?.id || null,
        actor_name: actor?.name || actor?.email || 'System',
        action,
        detail,
      },
      { requestKey: `log-${Date.now()}-${Math.random()}` },
    );
  } catch (err) {
    // Logging must never break the flow it is observing.
    console.warn('activity log failed', err);
  }
}
