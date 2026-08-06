import React from 'react';
import { Route, Routes, BrowserRouter as Router, Navigate } from 'react-router-dom';
import ScrollToTop from './components/ScrollToTop';
import { AuthProvider } from '@/context/AuthContext';
import { RequireAuth, RequireRole, RequireModule, RedirectIfAuthed } from '@/components/RouteGuards';
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
import QuotationFormPage from '@/pages/ops/QuotationFormPage';
import QuotationViewPage from '@/pages/ops/QuotationViewPage';
import ProjectsPage from '@/pages/ops/ProjectsPage';
import MaintenancePage from '@/pages/ops/MaintenancePage';
import ReportsPage from '@/pages/ops/ReportsPage';
import EmployeesPage from '@/pages/ops/EmployeesPage';
import DocumentsPage from '@/pages/ops/DocumentsPage';
import NotificationsPage from '@/pages/ops/NotificationsPage';
import PaymentsPage from '@/pages/ops/PaymentsPage';

// Wraps a page with both the login check and the module-level RBAC check in
// one place, since every protected route needs both in the same order.
function Protected({ moduleKey, children }) {
  return (
    <RequireAuth>
      <RequireModule moduleKey={moduleKey}>{children}</RequireModule>
    </RequireAuth>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<RedirectIfAuthed><LoginPage /></RedirectIfAuthed>} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Dashboard — every role lands here after login */}
          <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />

          {/* Super Administrator only */}
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

          {/* Sales: Leads, Clients, RFQs, Quotations */}
          <Route path="/crm" element={<Protected moduleKey="crm"><CrmDashboardPage /></Protected>} />
          <Route path="/crm/clients" element={<Protected moduleKey="clients"><ClientsPage /></Protected>} />
          <Route path="/crm/clients/new" element={<Protected moduleKey="clients"><ClientFormPage /></Protected>} />
          <Route path="/crm/clients/:id" element={<Protected moduleKey="clients"><ClientProfilePage /></Protected>} />
          <Route path="/crm/clients/:id/edit" element={<Protected moduleKey="clients"><ClientFormPage /></Protected>} />
          <Route path="/crm/pipeline" element={<Protected moduleKey="crm"><PipelinePage /></Protected>} />
          <Route path="/rfqs" element={<Protected moduleKey="rfq"><RfqsPage /></Protected>} />
          <Route path="/quotations" element={<Protected moduleKey="quotations"><QuotationsPage /></Protected>} />
          <Route path="/quotations/new" element={<Protected moduleKey="quotations"><QuotationFormPage /></Protected>} />
          <Route path="/quotations/:id/edit" element={<Protected moduleKey="quotations"><QuotationFormPage /></Protected>} />
          <Route path="/quotations/:id/view" element={<Protected moduleKey="quotations"><QuotationViewPage /></Protected>} />

          {/* Project Manager: Projects, Tasks, Maintenance, Project documents
              (Technicians also reach these — record-level scoping happens in
              the PocketBase collection rules, not here.) */}
          <Route path="/projects" element={<Protected moduleKey="projects"><ProjectsPage /></Protected>} />
          <Route path="/maintenance" element={<Protected moduleKey="maintenance"><MaintenancePage /></Protected>} />
          <Route path="/employees" element={<Protected moduleKey="employees"><EmployeesPage /></Protected>} />
          <Route path="/documents" element={<Protected moduleKey="documents"><DocumentsPage /></Protected>} />

          {/* Accountant: Invoices, Payments, Financial reports */}
          <Route path="/invoices" element={<Protected moduleKey="invoices"><InvoicesPage /></Protected>} />
          <Route path="/invoices/new" element={<Protected moduleKey="invoices"><InvoiceFormPage /></Protected>} />
          <Route path="/invoices/:id/edit" element={<Protected moduleKey="invoices"><InvoiceFormPage /></Protected>} />
          <Route path="/invoices/:id/view" element={<Protected moduleKey="invoices"><InvoiceViewPage /></Protected>} />
          <Route path="/payments" element={<Protected moduleKey="payments"><PaymentsPage /></Protected>} />
          <Route path="/reports" element={<Protected moduleKey="reports"><ReportsPage /></Protected>} />

          {/* Available to every role */}
          <Route path="/notifications" element={<Protected moduleKey="notifications"><NotificationsPage /></Protected>} />

          {/* Super Administrator only */}
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <RequireRole roles={['super_admin']}><SettingsPage /></RequireRole>
              </RequireAuth>
            }
          />

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}

export default App;
