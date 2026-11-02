import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';
import { roleLabel } from '@/lib/permissions';
import { BackLink, Loading } from '@/components/erp/kit';
import StaffProfileEditor from '@/components/erp/StaffProfileEditor';

// Super Admin / HR view of one person's profile, ID and certificates.
export default function StaffProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [account, setAccount] = useState(null);
  useEffect(() => { pb.collection('users').getOne(id).then(setAccount).catch(() => navigate('/users')); }, [id]);
  const done = Number(account?.profile_completed) === 1;
  return (
    <PortalLayout title={account?.name || account?.email || 'Staff profile'} subtitle={account ? `${roleLabel(account.role)} · ${account.email}` : 'Staff profile'}>
      <Helmet><title>Staff profile | RUNHTec Business Portal</title></Helmet>
      {!account ? <Loading /> : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <BackLink to="/users">User Management</BackLink>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
              {done ? 'Profile complete' : 'Profile not completed yet'}
            </span>
          </div>
          <StaffProfileEditor userId={account.id} account={account} />
        </>
      )}
    </PortalLayout>
  );
}
