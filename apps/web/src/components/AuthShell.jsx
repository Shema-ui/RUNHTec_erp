import React from 'react';
import { Helmet } from 'react-helmet';
import BrandMark from '@/components/BrandMark';
import { ShieldCheck, Building2, Users } from 'lucide-react';

export default function AuthShell({ children, pageTitle }) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1.05fr_0.95fr]">
      <Helmet>
        <title>{pageTitle} | RUNHTec Business Portal</title>
        <meta
          name="description"
          content="Secure internal business management portal for RUNHTec Contractors. Authorized personnel only."
        />
      </Helmet>

      {/* Brand panel */}
      <div className="relative hidden overflow-hidden lg:flex lg:flex-col" style={{ background: '#001f5a' }}>
        {/* Blue base with subtle red diagonal accent */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(135deg, #001f5a 0%, #003DA5 55%, #002d80 100%)',
          }}
        />
        {/* Red accent streak */}
        <div
          className="pointer-events-none absolute"
          style={{
            top: '-10%', right: '10%',
            width: '3px', height: '60%',
            background: 'linear-gradient(180deg, transparent, #E5151A 30%, #E5151A 70%, transparent)',
            transform: 'rotate(-15deg)',
            opacity: 0.7,
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)',
            backgroundSize: '46px 46px',
          }}
        />
        <div className="relative z-10 flex flex-1 flex-col p-12">
          <BrandMark variant="auth" />

          <div className="mt-auto max-w-md">
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white mt-10">
              The operating system for RUNHTec Contractors.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-300">
              A secure, role-based platform unifying clients, projects, quotations
              and operations into one enterprise workspace.
            </p>

            <div className="mt-10 space-y-4">
              {[
                { icon: ShieldCheck, t: 'Role-based access control', d: 'Every action scoped to permissions.' },
                { icon: Building2, t: 'Built to scale', d: 'A foundation ready for the full ERP.' },
                { icon: Users, t: 'Managed accounts', d: 'Provisioned only by administrators.' },
              ].map(({ icon: Icon, t, d }) => (
                <div key={t} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/15">
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{t}</p>
                    <p className="text-xs text-slate-400">{d}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 mt-12 text-xs text-slate-500">
            © {new Date().getFullYear()} RUNHTec Contractors. Internal use only.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark />
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
