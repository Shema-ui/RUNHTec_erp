import React from 'react';
import { useAuth } from '@/context/AuthContext';
import PrivateLinkCard from '@/components/erp/PrivateLinkCard';

const MANAGE = ['super_admin', 'admin', 'sales', 'project_manager'];

// On the client profile: the client's private portal link.
export default function ClientPortalCard({ client }) {
  const { user } = useAuth();
  if (!MANAGE.includes(user?.role)) return null;
  return (
    <PrivateLinkCard
      api="/api/portal" field="client" id={client.id} name={client.company_name} path="/p/"
      title="Client portal"
      description="A private link where the client follows progress, sees the photos you share, invoices and messages. They only type their name, no password."
      previewTo={`/portal?as=${client.id}`}
      shareText={(link) => `Hello, this is RUNHTec Contractors. You can follow your project, see site photos, invoices and message our team here: ${link}\nJust open the link and type your name. Please keep it private.`}
    />
  );
}
