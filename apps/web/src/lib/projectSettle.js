// A project counts as "completed" only when its work is done AND every invoice for it is paid.
// A done project that still has money owed stays in the open project lists until it is paid.
const LEFT_OUT = ['draft', 'cancelled'];

// Per project: total invoiced (incl. VAT) and total paid against those invoices.
export function projectBalances(invoices = [], payments = []) {
  const paidByInvoice = {};
  (payments || []).filter((p) => p.status === 'completed' && p.invoice).forEach((p) => {
    paidByInvoice[p.invoice] = (paidByInvoice[p.invoice] || 0) + Number(p.amount || 0);
  });
  const byProject = {};
  (invoices || []).filter((i) => i.project && !LEFT_OUT.includes(i.status)).forEach((i) => {
    const b = byProject[i.project] || (byProject[i.project] = { invoiced: 0, paid: 0 });
    b.invoiced += Number(i.total || 0);
    b.paid += paidByInvoice[i.id] || 0;
  });
  return byProject;
}

// Done and fully paid. A done project with no invoices has nothing owed, so it is completed.
export function isSettled(project, balances = {}) {
  if (project?.status !== 'done') return false;
  const b = balances[project.id];
  if (!b) return true;
  return b.invoiced - b.paid <= 0.5;
}
