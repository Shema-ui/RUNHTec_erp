import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Users, Phone, Briefcase } from 'lucide-react';
import PortalLayout from '@/layouts/PortalLayout';
import pb from '@/lib/pocketbaseClient';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await pb.collection('employees').getList(1, 100, { sort: 'created' });
        setEmployees(result.items || []);
      } catch (error) {
        console.error('Employees load error', error);
      }
    };
    load();
  }, []);
  return (
    <PortalLayout title="Employees" subtitle="People, roles and specialist coverage">
      <Helmet>
        <title>Employees | RUNHTec Business Portal</title>
        <meta name="description" content="Manage employee roster, roles and coverage." />
      </Helmet>

      <div className="grid gap-4">
        {employees.map((person) => (
          <div key={person.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-accent p-3 text-primary">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold text-foreground">{person.user ? person.user : 'Employee'}</h3>
                <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Briefcase className="h-4 w-4" /> {person.role || '—'}</span>
                  <span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" /> {person.phone || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </PortalLayout>
  );
}
