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

export default function InvoicePrintSheet({ kind = 'invoice', inv, cfg, items, currency, companyName, logoSrc, signatureSrc, stampSrc, paidSoFar = 0, balance = 0, fmt }) {
  const isQuote = kind === 'quote';
  const title = isQuote ? 'QUOTE' : 'INVOICE';
  const docNumber = isQuote ? inv.number : inv.invoice_number;
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
  const issued = isQuote && inv.created ? new Date(inv.created).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : date;
  const validUntil = isQuote && inv.valid_until ? new Date(inv.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const totalRow = (text, value, strong) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', fontSize: strong ? '15px' : '13px', fontWeight: strong ? 700 : 400, color: strong ? INK : MUTED, borderTop: strong ? `2px solid ${INK}` : 'none' }}>
      <span>{text}</span><span style={{ color: INK }}>{value}</span>
    </div>
  );

  return (
    <div style={{ width: '794px', boxSizing: 'border-box', background: '#ffffff', color: INK, fontFamily: 'Helvetica, Arial, sans-serif', padding: '34px 56px', fontSize: '13px', lineHeight: 1.45 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', borderBottom: `3px solid ${ACCENT}`, paddingBottom: '14px' }}>
        {logoSrc && <img src={logoSrc} alt="" style={{ height: '48px', width: 'auto' }} />}
        <div>
          <div style={{ fontSize: '17px', fontWeight: 700, color: INK }}>{companyName}</div>
          {cfg.company_tagline && <div style={{ fontSize: '11px', color: MUTED }}>{cfg.company_tagline}</div>}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>{isQuote ? 'Quote' : 'Invoice'} # {docNumber}</div>
          <div style={{ fontSize: '12px', color: MUTED }}>{issued}</div>
        </div>
      </div>

      <div style={{ fontSize: '32px', fontWeight: 300, margin: '18px 0 16px', color: INK }}>{title}</div>

      {/* Bill to and payment */}
      <div style={{ display: 'flex', gap: '40px', marginBottom: '18px' }}>
        <div style={{ flex: 1 }}>
          <div style={label}>Bill to</div>
          <div style={{ fontWeight: 700 }}>{inv.bill_to_name || '—'}</div>
          {inv.bill_to_company && <div>{inv.bill_to_company}</div>}
          {inv.bill_to_address && <div style={{ color: MUTED, whiteSpace: 'pre-line' }}>{inv.bill_to_address}</div>}
          {inv.bill_to_phone && <div style={{ color: MUTED }}>{inv.bill_to_phone}</div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={label}>{isQuote ? 'Details' : 'Payment'}</div>
          {!isQuote && <div style={{ color: MUTED }}>Payment terms: <span style={{ color: INK }}>{inv.payment_terms || '—'}</span></div>}
          {!isQuote && due && <div style={{ color: MUTED }}>Due date: <span style={{ color: INK }}>{due}</span></div>}
          {isQuote && validUntil && <div style={{ color: MUTED }}>Valid until: <span style={{ color: INK }}>{validUntil}</span></div>}
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
        {!isQuote && Number(paidSoFar) > 0 && totalRow('Paid', `-${fmt(paidSoFar, currency)}`)}
        {!isQuote && Number(paidSoFar) > 0 && totalRow('Balance due', fmt(balance, currency), true)}
      </div>

      {/* Notes, payment, terms */}
      <div style={{ marginTop: '22px', display: 'flex', gap: '40px' }}>
        <div style={{ flex: 1 }}>
          {inv.notes && (<><div style={label}>Notes</div><div style={{ whiteSpace: 'pre-line', marginBottom: '16px' }}>{inv.notes}</div></>)}
          {!isQuote && inv.payment_instructions && (<><div style={label}>Payment instructions</div><div style={{ whiteSpace: 'pre-line', marginBottom: '16px' }}>{inv.payment_instructions}</div></>)}
          {bank.length > 0 && (
            <>
              <div style={label}>Payment details</div>
              {bank.map(([k, v]) => (<div key={k}><span style={{ color: MUTED }}>{k}: </span>{v}</div>))}
            </>
          )}
        </div>
      </div>
      {inv.terms_conditions && (
        <div style={{ marginTop: '14px' }}>
          <div style={label}>Terms</div>
          <div style={{ whiteSpace: 'pre-line', color: MUTED, fontSize: '12px' }}>{inv.terms_conditions}</div>
        </div>
      )}

      {/* Signature */}
      {(cfg.signature_name || signatureSrc || stampSrc) && (
        <div style={{ marginTop: '22px', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', width: '260px', textAlign: 'center', paddingTop: '6px' }}>
            {signatureSrc && <img src={signatureSrc} alt="" style={{ height: '50px', width: 'auto', display: 'block', margin: '0 auto' }} />}
            {stampSrc && (
              <img src={stampSrc} alt="" style={{ position: 'absolute', height: '84px', width: 'auto', left: '50%', top: '-6px', transform: 'translateX(-50%) rotate(-8deg)', opacity: 0.9, pointerEvents: 'none' }} />
            )}
            <div style={{ borderTop: `1px solid ${INK}`, marginTop: '4px', paddingTop: '4px', fontWeight: 700 }}>{cfg.signature_name || ''}</div>
            {cfg.signature_position && <div style={{ color: MUTED, fontSize: '12px' }}>{cfg.signature_position}</div>}
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '20px', borderTop: `1px solid ${RULE}`, paddingTop: '8px', fontSize: '11px', color: MUTED, textAlign: 'center' }}>
        {[companyName, cfg.company_registration_number && `Reg. No: ${cfg.company_registration_number}`, addressLine, cfg.company_website].filter(Boolean).join('  ·  ')}
        {cfg.invoice_footer_text && <div style={{ marginTop: '4px' }}>{cfg.invoice_footer_text}</div>}
      </div>
    </div>
  );
}
