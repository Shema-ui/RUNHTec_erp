import React from 'react';
import { Helmet } from 'react-helmet';
import PortalLayout from '@/layouts/PortalLayout';
import ReferralCard from '@/components/ReferralCard';

export default function ReferralsPage() {
  return (
    <PortalLayout>
      <Helmet><title>Referrals · RUNHTec</title></Helmet>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <h1 className="text-2xl font-bold">Referrals</h1>
        <ReferralCard />
      </div>
    </PortalLayout>
  );
}
