import React from 'react';
import { Helmet } from 'react-helmet';
import PortalLayout from '@/layouts/PortalLayout';
import { useAuth } from '@/context/AuthContext';
import { needsProfile } from '@/lib/permissions';
import StaffProfileEditor from '@/components/erp/StaffProfileEditor';

export default function MyProfilePage() {
  const { user } = useAuth();
  const onboarding = needsProfile(user);
  return (
    <PortalLayout title="My profile" subtitle={onboarding ? 'Complete your profile to open your account' : 'Your details, ID and certificates'}>
      <Helmet><title>My profile | RUNHTec Business Portal</title></Helmet>
      {user && <StaffProfileEditor userId={user.id} account={user} onboarding={onboarding} />}
    </PortalLayout>
  );
}
