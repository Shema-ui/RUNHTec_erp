import React from 'react';

// Client-facing invoice, laid out for A4 (794 px wide). Plain and quiet, in the
// style of the quotation: one light header, a light table, clear totals.
// Used only for the PDF and emails the client receives; the screen view is separate.
const INK = '#1f2937';
const MUTED = '#6b7280';
const RULE = '#d1d5db';
const TINT = '#f3f4f6';
const ACCENT = '#881946';

const label = { fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: MUTED, marginBottom: '6px' };

export default function InvoicePrintSheet({ inv, cfg, items, currency, companyName, logoSrc, signatureSrc, stampSrc, paidSoFar, balance, fmt }) {
  const addressLine = [cfg.company_address, cfg.company_phone, cfg.company_email].filter(Boolean).join('  ·  ');
  const bank = [
    cfg.bank_name && ['Bank', cfg.bank_name],
    cfg.account_name && ['Account name', cfg.account_name],
    cfg.account_number && ['Account number', cfg.account_number],
    cfg.branch_code && ['Branch code', cfg.branch_code],
    cfg.swift_code && ['SWIFT', cfg.swift_code],
  ].filter(Boolean);
  const date = inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const due = inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const totalRow = (text, value, strong) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: strong ? '15px' : '13px', fontWeight: strong ? 700 : 400, color: strong ? INK : MUTED, borderTop: strong ? `2px solid ${INK}` : 'none' }}>
      <span>{text}</span><span style={{ color: INK }}>{value}</span>
    </div>
  );

  return (
    <div style={{ width: '794px', boxSizing: 'border-box', background: '#ffffff', color: INK, fontFamily: 'Helvetica, Arial, sans-serif', padding: '44px 56px', fontSize: '13px', lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderBottom: `3px solid ${ACCENT}`, paddingBottom: '14px' }}>
        {logoSrc && <img src={logoSrc} alt="" style={{ height: '48px', width: 'auto' }} />}
        <div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: INK }}>{companyName}</div>
          {cfg.company_tagline && <div style={{ fontSize: '11px', color: MUTED }}>{cfg.company_tagline}</div>}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>Invoice # {inv.invoice_number}</div>
          <div style={{ fontSize: '12px', color: MUTED }}>{date}</div>
        </div>
      </div>

      <div style={{ fontSize: '34px', fontWeight: 300, margin: '26px 0 22px', color: INK }}>INVOICE</div>

      {/* Bill to and payment */}
      <div style={{ display: 'flex', gap: '40px', marginBottom: '24px' }}>
        <div style={{ flex: 1 }}>
          <div style={label}>Bill to</div>
          <div style={{ fontWeight: 700 }}>{inv.bill_to_name || '—'}</div>
          {inv.bill_to_company && <div>{inv.bill_to_company}</div>}
          {inv.bill_to_address && <div style={{ color: MUTED, whiteSpace: 'pre-line' }}>{inv.bill_to_address}</div>}
          {inv.bill_to_phone && <div style={{ color: MUTED }}>{inv.bill_to_phone}</div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={label}>Payment</div>
          <div style={{ color: MUTED }}>Payment terms: <span style={{ color: INK }}>{inv.payment_terms || '—'}</span></div>
          {due && <div style={{ color: MUTED }}>Due date: <span style={{ color: INK }}>{due}</span></div>}
        </div>
      </div>

      {/* Items */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ background: TINT }}>
            <th style={{ textAlign: 'left', padding: '9px 12px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED }}>Item</th>
            <th style={{ textAlign: 'center', padding: '9px 12px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, width: '80px' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '9px 12px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, width: '130px' }}>Rate</th>
            <th style={{ textAlign: 'right', padding: '9px 12px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: MUTED, width: '140px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: `1px solid ${RULE}`, pageBreakInside: 'avoid' }}>
              <td style={{ padding: '11px 12px', fontWeight: 600 }}>{item.description || '—'}</td>
              <td style={{ padding: '11px 12px', textAlign: 'center' }}>{item.quantity}</td>
              <td style={{ padding: '11px 12px', textAlign: 'right' }}>{fmt(item.unit_price, currency)}</td>
              <td style={{ padding: '11px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(item.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ marginLeft: 'auto', width: '300px', marginTop: '14px' }}>
        {totalRow('Subtotal', fmt(inv.subtotal, currency))}
        {Number(inv.discount_amount) > 0 && totalRow('Discount', `-${fmt(inv.discount_amount, currency)}`)}
        {totalRow(`Tax (${inv.tax_rate ?? 0}%)`, fmt(inv.tax_amount || 0, currency))}
        {totalRow('Total', fmt(inv.total, currency), true)}
        {Number(paidSoFar) > 0 && totalRow('Paid', `-${fmt(paidSoFar, currency)}`)}
        {Number(paidSoFar) > 0 && totalRow('Balance due', fmt(balance, currency), true)}
      </div>

      {/* Notes, payment, terms */}
      <div style={{ marginTop: '30px', display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          {inv.notes && (<><div style={label}>Notes</div><div style={{ whiteSpace: 'pre-line', marginBottom: '16px' }}>{inv.notes}</div></>)}
          {inv.payment_instructions && (<><div style={label}>Payment instructions</div><div style={{ whiteSpace: 'pre-line', marginBottom: '16px' }}>{inv.payment_instructions}</div></>)}
          {bank.length > 0 && (
            <>
              <div style={label}>Bank details</div>
              {bank.map(([k, v]) => (<div key={k}><span style={{ color: MUTED }}>{k}: </span>{v}</div>))}
            </>
          )}
        </div>
      </div>
      {inv.terms_conditions && (
        <div style={{ marginTop: '18px' }}>
          <div style={label}>Terms</div>
          <div style={{ whiteSpace: 'pre-line', color: MUTED, fontSize: '12px' }}>{inv.terms_conditions}</div>
        </div>
      )}

      {/* Signature */}
      {(cfg.signature_name || signatureSrc) && (
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '240px', textAlign: 'center' }}>
            {signatureSrc && <img src={signatureSrc} alt="" style={{ height: '50px', width: 'auto' }} />}
            <div style={{ borderTop: `1px solid ${INK}`, paddingTop: '4px', fontWeight: 700 }}>{cfg.signature_name || ''}</div>
            {cfg.signature_position && <div style={{ color: MUTED, fontSize: '12px' }}>{cfg.signature_position}</div>}
            {stampSrc && <img src={stampSrc} alt="" style={{ height: '70px', width: 'auto', marginTop: '6px' }} />}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '30px', borderTop: `1px solid ${RULE}`, paddingTop: '10px', fontSize: '11px', color: MUTED, textAlign: 'center' }}>
        {[companyName, cfg.company_registration_number && `Reg. No: ${cfg.company_registration_number}`, addressLine, cfg.company_website].filter(Boolean).join('  ·  ')}
        {cfg.invoice_footer_text && <div style={{ marginTop: '4px' }}>{cfg.invoice_footer_text}</div>}
      </div>
    </div>
  );
}
