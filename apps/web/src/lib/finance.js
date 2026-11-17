// Shared helpers for expenses, profit and CSV exports.
import { costCategoryLabel } from '@/lib/costing';

// Everything spent on a project, in its own currency.
export const sumAmount = (rows = []) => rows.reduce((s, c) => s + (Number(c.amount) || 0), 0);

// Split a project's expenses into the three report columns.
export function splitExpenses(costs = []) {
  const out = { materials: 0, wages: 0, other: 0, unpaid: 0, total: 0 };
  for (const c of costs) {
    const a = Number(c.amount) || 0;
    if (c.category === 'materials') out.materials += a;
    else if (c.category === 'labour') out.wages += a;
    else out.other += a;
    if (!c.paid) out.unpaid += a;
    out.total += a;
  }
  return out;
}

export const expenseTypeLabel = (c) => (c.category === 'labour' ? 'Wages' : costCategoryLabel(c.category));

// Quote a value for CSV: wrap in quotes when it contains a comma, quote or line break.
function csvCell(v) {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Download rows (array of arrays) as a CSV file that opens cleanly in Excel.
export function downloadCsv(filename, rows) {
  const text = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
