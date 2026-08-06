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
import RfqsPage from '@/pages/ops/RfqsPage';
import QuotationsPage from '@/pages/ops/QuotationsPage';
import ProjectsPage from '@/pages/ops/ProjectsPage';
import MaintenancePage from '@/pages/ops/MaintenancePage';
import ReportsPage from '@/pages/ops/ReportsPage';
import EmployeesPage from '@/pages/ops/EmployeesPage';
import DocumentsPage from '@/pages/ops/DocumentsPage';
import NotificationsPage from '@/pages/ops/NotificationsPage';
import PaymentsPage from '@/pages/ops/PaymentsPage';

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

          {/* ERP / Operations Modules */}
          <Route path="/rfqs" element={<RequireAuth><RfqsPage /></RequireAuth>} />
          <Route path="/quotations" element={<RequireAuth><QuotationsPage /></RequireAuth>} />
          <Route path="/projects" element={<RequireAuth><ProjectsPage /></RequireAuth>} />
          <Route path="/maintenance" element={<RequireAuth><MaintenancePage /></RequireAuth>} />
          <Route path="/reports" element={<RequireAuth><ReportsPage /></RequireAuth>} />
          <Route path="/employees" element={<RequireAuth><EmployeesPage /></RequireAuth>} />
          <Route path="/documents" element={<RequireAuth><DocumentsPage /></RequireAuth>} />
          <Route path="/notifications" element={<RequireAuth><NotificationsPage /></RequireAuth>} />
          <Route path="/payments" element={<RequireAuth><PaymentsPage /></RequireAuth>} />

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
