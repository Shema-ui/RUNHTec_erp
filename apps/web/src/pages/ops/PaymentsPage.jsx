import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { CreditCard, CheckCircle2 } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await pb.collection('payments').getList(1, 100, { sort: '-created' });
        setPayments(result.items || []);
      } catch (error) {
        console.error('Payments load error', error);
      }
    };
    load();
  }, []);
  return (
    <PortalLayout title="Payments" subtitle="Hosted checkout and payment tracking">
      <Helmet>
        <title>Payments | RUNHTec Business Portal</title>
        <meta name="description" content="Track online payments and transaction references." />
      </Helmet>

      <div className="grid gap-4">
        {payments.map((payment) => (
          <div key={payment.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent p-3 text-primary">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">{payment.reference || payment.transaction_reference || 'Payment'}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{payment.client || 'Client record'}</p>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {payment.status || 'pending'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PortalLayout>
  );
}
