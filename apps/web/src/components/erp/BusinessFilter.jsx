import React from 'react';

export const BUSINESSES = [
  { value: 'runhtec', label: 'RUNHTec Contractors' },
  { value: 'orvio', label: 'Orvio' },
];

// Records without a business (older ones) belong to RUNHTec.
export function inBusiness(rec, business) {
  return business === 'all' || (rec?.business || 'runhtec') === business;
}

export default function BusinessFilter({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Business"
      className="h-10 rounded-lg border border-border bg-background px-3 text-sm outline-none"
    >
      <option value="all">All businesses</option>
      {BUSINESSES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
    </select>
  );
}
