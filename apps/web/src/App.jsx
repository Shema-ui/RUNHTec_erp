import React from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from '@/context/AuthContext';
import { RequireAuth, RequireRole, RedirectIfAuthed } from '@/components/RouteGuards';
import { Toaster } from '@/components/ui/toaster';

import LoginPage from '@/pages/LoginPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import DashboardPage from '@/pages/DashboardPage';
import UsersPage from '@/pages/UsersPage';
import ActivityLogPage from '@/pages/ActivityLogPage';
import CrmDashboardPage from '@/pages/crm/CrmDashboardPage';
import ClientsPage from '@/pages/crm/ClientsPage';
import ClientFormPage from '@/pages/crm/ClientFormPage';
import ClientProfilePage from '@/pages/crm/ClientProfilePage';
import PipelinePage from '@/pages/crm/PipelinePage';
import InvoicesPage from '@/pages/invoices/InvoicesPage';
import InvoiceFormPage from '@/pages/invoices/InvoiceFormPage';
import InvoiceViewPage from '@/pages/invoices/InvoiceViewPage';
import SettingsPage from '@/pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route
            path="/users"
            element={
              <RequireAuth>
                <RequireRole roles={['super_admin']}><UsersPage /></RequireRole>
              </RequireAuth>
            }
          />
          <Route
            path="/activity"
            element={
              <RequireAuth>
                <RequireRole roles={['super_admin']}><ActivityLogPage /></RequireRole>
              </RequireAuth>
            }
          />

          {/* CRM Module */}
          <Route path="/crm" element={<RequireAuth><CrmDashboardPage /></RequireAuth>} />
          <Route path="/crm/clients" element={<RequireAuth><ClientsPage /></RequireAuth>} />
          <Route path="/crm/clients/new" element={<RequireAuth><ClientFormPage /></RequireAuth>} />
          <Route path="/crm/clients/:id" element={<RequireAuth><ClientProfilePage /></RequireAuth>} />
          <Route path="/crm/clients/:id/edit" element={<RequireAuth><ClientFormPage /></RequireAuth>} />
          <Route path="/crm/pipeline" element={<RequireAuth><PipelinePage /></RequireAuth>} />

          {/* Invoices Module */}
          <Route path="/invoices" element={<RequireAuth><InvoicesPage /></RequireAuth>} />
          <Route path="/invoices/new" element={<RequireAuth><InvoiceFormPage /></RequireAuth>} />
          <Route path="/invoices/:id/edit" element={<RequireAuth><InvoiceFormPage /></RequireAuth>} />
          <Route path="/invoices/:id/view" element={<RequireAuth><InvoiceViewPage /></RequireAuth>} />

          {/* Settings */}
          <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;
