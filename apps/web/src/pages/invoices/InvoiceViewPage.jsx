import React, { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit2, Printer, ChevronLeft, Loader2, Download } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';

// Fallback logo used only when no logo has been uploaded in Settings.
const DEFAULT_LOGO_URL = 'https://horizons-cdn.hostinger.com/2757b26b-44c6-4111-a4b2-af6d71351715/f9d1fad541d7f3b6fd43d5a1326794e7.jpg';
const DEFAULT_COMPANY_NAME = 'RUNHTec Contractors';
const BRAND = '#003DA5';

const STATUS_COLORS = {
  draft:     { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  sent:      { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  paid:      { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  overdue:   { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  cancelled: { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
};

function fmt(n, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR', minimumFractionDigits: 2 }).format(n || 0);
}

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #invoice-print, #invoice-print * { visibility: visible !important; }
  #invoice-print { position: fixed; left: 0; top: 0; width: 210mm; background: white; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 0; }
}
`;

// Convert an image URL (same-origin PocketBase file or an external default)
// to a Base64 data URL so it embeds cleanly into the html2canvas render and
// avoids CORS/tainted-canvas issues either way.
async function toBase64Image(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'no-cache' });
    if (res.ok) {
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image') && dataUrl.length > 100) {
        return dataUrl;
      }
    }
  } catch (err) {
    console.warn('[InvoicePDF] fetch/blob image load failed, trying canvas:', err?.message || err);
  }
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 240;
    canvas.height = img.naturalHeight || 240;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl && dataUrl.length > 100) return dataUrl;
  } catch (err) {
    console.error('[InvoicePDF] canvas image load failed:', err?.message || err);
  }
  console.error('[InvoicePDF] could not convert image to Base64:', url);
  return null;
}

export default function InvoiceViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Base64-embedded copies of the logo/signature/stamp, keyed by their
  // source URL, used for the PDF capture only (the on-screen render uses
  // the plain PocketBase file URLs, which load fine in the browser).
  const [embeds, setEmbeds] = useState({ logo: null, signature: null, stamp: null });
  const printRef = useRef(null);

  useEffect(() => {
    Promise.all([
      pb.collection('invoices').getOne(id, { requestKey: `view-inv-${id}` }),
      pb.collection('company_settings').getList(1, 1, { requestKey: 'view-settings' })
        .then(r => r.items[0] || null).catch(() => null),
    ]).then(([inv, cfg]) => {
      setInvoice(inv);
      setSettings(cfg);
      setLoading(false);
    }).catch(() => navigate('/invoices'));
  }, [id]);

  const logoUrl = settings?.logo ? pb.files.getURL(settings, settings.logo) : DEFAULT_LOGO_URL;
  const signatureUrl = settings?.signature ? pb.files.getURL(settings, settings.signature) : null;
  const stampUrl = settings?.stamp ? pb.files.getURL(settings, settings.stamp) : null;
  const showSignature = settings?.show_signature !== false && Boolean(signatureUrl);
  const showStamp = settings?.show_stamp !== false && Boolean(stampUrl);

  // Preload and Base64-embed the logo (and signature/stamp if shown) once
  // their URLs are known — avoids CORS/tainted-canvas issues in the PDF.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [logo, signature, stamp] = await Promise.all([
        toBase64Image(logoUrl),
        showSignature ? toBase64Image(signatureUrl) : Promise.resolve(null),
        showStamp ? toBase64Image(stampUrl) : Promise.resolve(null),
      ]);
      if (!cancelled) setEmbeds({ logo: logo || logoUrl, signature: signature || signatureUrl, stamp: stamp || stampUrl });
    })();
    return () => { cancelled = true; };
  }, [logoUrl, signatureUrl, stampUrl, showSignature, showStamp]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');

      // Guarantee embeds are ready before capture.
      let currentEmbeds = embeds;
      if (!String(currentEmbeds.logo).startsWith('data:image')) {
        const [logo, signature, stamp] = await Promise.all([
          toBase64Image(logoUrl),
          showSignature ? toBase64Image(signatureUrl) : Promise.resolve(null),
          showStamp ? toBase64Image(stampUrl) : Promise.resolve(null),
        ]);
        currentEmbeds = { logo: logo || logoUrl, signature: signature || signatureUrl, stamp: stamp || stampUrl };
        setEmbeds(currentEmbeds);
        await new Promise((r) => setTimeout(r, 150));
      }

      const el = document.getElementById('invoice-print');
      const imgs = Array.from(el.querySelectorAll('img'));
      await Promise.all(imgs.map((img) => (
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            })
      )));
      const canvas = await html2canvas(el, { scale: 3, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', imageTimeout: 15000 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      let y = 0;
      const pageH = pdf.internal.pageSize.getHeight();
      while (y < pdfH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -y, pdfW, pdfH);
        y += pageH;
      }
      pdf.save(`${invoice?.invoice_number || 'invoice'}.pdf`);
    } catch (e) {
      alert('PDF generation failed: ' + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      const updated = await pb.collection('invoices').update(id, { status });
      setInvoice(updated);
    } catch (e) { alert(e.message); }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const inv = invoice;
  const cfg = settings || {};
  const items = Array.isArray(inv.items) ? inv.items : [];
  const statusColor = STATUS_COLORS[inv.status] || STATUS_COLORS.draft;
  const currency = inv.currency || cfg.currency || 'ZAR';
  const statusLabel = inv.status ? inv.status.charAt(0).toUpperCase() + inv.status.slice(1) : 'Draft';
  const companyName = cfg.company_name || DEFAULT_COMPANY_NAME;
  const logoSrc = embeds.logo || logoUrl;
  const signatureSrc = embeds.signature || signatureUrl;
  const stampSrc = embeds.stamp || stampUrl;

  const cardLabel = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '10px' };

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      <style>{PRINT_STYLE}</style>
      <Helmet>
        <title>{inv.invoice_number} | RUNHTec Invoice</title>
        <meta name="description" content={`Invoice ${inv.invoice_number} from ${companyName}`} />
      </Helmet>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur-sm px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <Link to="/invoices" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <span
            className="inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: statusColor.bg, color: statusColor.text, borderColor: statusColor.border }}
          >
            {statusLabel}
          </span>
          <select
            className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs font-medium"
            value={inv.status || 'draft'}
            onChange={e => handleStatusChange(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="ml-auto flex gap-2">
            <Link
              to={`/invoices/${id}/edit`}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              <Edit2 className="h-4 w-4" /> Edit
            </Link>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg bg-[#003DA5] px-4 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-[#003DA5]/90 disabled:opacity-60"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {downloading ? 'Generating…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* A4 Invoice */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div
          id="invoice-print"
          ref={printRef}
          className="rounded-2xl bg-white shadow-xl"
          style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontSize: '13px', lineHeight: '1.5', color: '#1e293b' }}
        >
          {/* Header */}
          <div style={{ background: BRAND, borderRadius: '16px 16px 0 0', padding: '32px 40px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
              {/* Logo + Company */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ background: 'white', borderRadius: '10px', padding: '6px', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  <img src={logoSrc} alt={companyName} style={{ width: '52px', height: '52px', objectFit: 'contain' }} />
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 800, fontSize: '18px', letterSpacing: '-0.3px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {companyName}
                  </div>
                  {cfg.company_tagline && (
                    <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', fontStyle: 'italic', marginTop: '1px' }}>
                      {cfg.company_tagline}
                    </div>
                  )}
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', marginTop: '4px' }}>
                    {cfg.company_address || 'Kigali, Rwanda'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px' }}>
                    {[cfg.company_phone, cfg.company_email, cfg.company_website].filter(Boolean).join('  |  ')}
                  </div>
                </div>
              </div>
              {/* Invoice title */}
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'white', fontWeight: 900, fontSize: '36px', letterSpacing: '-1px', lineHeight: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  INVOICE
                </div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '15px', marginTop: '4px', fontFamily: 'monospace' }}>
                  {inv.invoice_number}
                </div>
                <div style={{ marginTop: '8px', display: 'inline-block', background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`, borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
                  {statusLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Meta row: invoice number, dates, status kept clearly visible together */}
          <div style={{ background: '#f8fafc', padding: '20px 40px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            {[
              { label: 'Invoice Number', value: inv.invoice_number || '—' },
              { label: 'Invoice Date', value: inv.invoice_date || '—' },
              { label: 'Due Date', value: inv.due_date || '—' },
              { label: 'Payment Terms', value: inv.payment_terms || '—' },
              { label: 'Payment Status', value: statusLabel },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '2px' }}>{m.label}</div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Bill To / From — card layout */}
          <div style={{ padding: '28px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
              <div style={cardLabel}>Bill To</div>
              {inv.bill_to_name && <div style={{ fontWeight: 700, fontSize: '15px' }}>{inv.bill_to_name}</div>}
              {inv.bill_to_company && <div style={{ fontWeight: inv.bill_to_name ? 500 : 700, fontSize: inv.bill_to_name ? '13px' : '15px', color: inv.bill_to_name ? '#475569' : '#1e293b' }}>{inv.bill_to_company}</div>}
              {inv.bill_to_address && <div style={{ color: '#64748b', marginTop: '4px', whiteSpace: 'pre-line' }}>{inv.bill_to_address}</div>}
              {inv.bill_to_email && <div style={{ color: '#64748b', marginTop: '4px' }}>{inv.bill_to_email}</div>}
              {inv.bill_to_phone && <div style={{ color: '#64748b' }}>{inv.bill_to_phone}</div>}
              {!inv.bill_to_name && !inv.bill_to_company && <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No client specified</div>}
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
              <div style={cardLabel}>From</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{companyName}</div>
              {cfg.company_registration_number && <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>Reg. No: {cfg.company_registration_number}</div>}
              {cfg.company_address && <div style={{ color: '#64748b', marginTop: '4px', whiteSpace: 'pre-line' }}>{cfg.company_address}</div>}
              {cfg.company_phone && <div style={{ color: '#64748b', marginTop: '4px' }}>{cfg.company_phone}</div>}
              {cfg.company_email && <div style={{ color: '#64748b' }}>{cfg.company_email}</div>}
              {cfg.company_website && <div style={{ color: '#64748b' }}>{cfg.company_website}</div>}
            </div>
          </div>

          {/* Items Table */}
          <div style={{ padding: '28px 40px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: BRAND }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', color: 'white', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', borderRadius: '6px 0 0 6px' }}>Description</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center', color: 'white', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: '80px' }}>Qty</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: 'white', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: '130px' }}>Unit Price</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', color: 'white', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', width: '130px', borderRadius: '0 6px 6px 0' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? '#f8fafc' : 'white', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 500 }}>{item.description || <em style={{ color: '#94a3b8' }}>No description</em>}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>{item.quantity}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#475569' }}>{fmt(item.unit_price, currency)}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600 }}>{fmt(item.amount, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{ width: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Subtotal</span>
                  <span style={{ fontWeight: 500 }}>{fmt(inv.subtotal, currency)}</span>
                </div>
                {inv.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>Discount</span>
                    <span style={{ fontWeight: 500, color: '#16a34a' }}>-{fmt(inv.discount_amount, currency)}</span>
                  </div>
                )}
                {inv.tax_rate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>VAT / Tax ({inv.tax_rate}%)</span>
                    <span style={{ fontWeight: 500 }}>{fmt(inv.tax_amount, currency)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 14px', marginTop: '6px', background: BRAND, borderRadius: '8px' }}>
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total Due</span>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '19px' }}>{fmt(inv.total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Payment Instructions */}
          {(inv.notes || inv.payment_instructions) && (
            <div style={{ padding: '0 40px 24px', display: 'grid', gridTemplateColumns: inv.notes && inv.payment_instructions ? '1fr 1fr' : '1fr', gap: '24px', borderBottom: '1px solid #e2e8f0' }}>
              {inv.notes && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>Notes</div>
                  <div style={{ color: '#475569', whiteSpace: 'pre-line', lineHeight: '1.6' }}>{inv.notes}</div>
                </div>
              )}
              {inv.payment_instructions && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>Payment Instructions</div>
                  <div style={{ color: '#475569', whiteSpace: 'pre-line', lineHeight: '1.6' }}>{inv.payment_instructions}</div>
                </div>
              )}
            </div>
          )}

          {/* Bank Details */}
          <div style={{ margin: '0 40px 24px', padding: '20px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: BRAND, marginBottom: '12px' }}>
              Payment / Banking Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px 24px' }}>
              {[
                { label: 'Bank Name', value: cfg.bank_name },
                { label: 'Account Name', value: cfg.account_name },
                { label: 'Account Number', value: cfg.account_number },
                { label: 'Branch Code', value: cfg.branch_code },
                { label: 'SWIFT Code', value: cfg.swift_code },
                { label: 'Currency', value: cfg.currency || inv.currency },
              ].map(f => (
                f.value ? (
                  <div key={f.label}>
                    <div style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</div>
                    <div style={{ fontWeight: 600, marginTop: '2px' }}>{f.value}</div>
                  </div>
                ) : null
              ))}
            </div>
          </div>

          {/* Terms & Digital Authorization */}
          <div style={{ padding: '0 40px 32px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '40px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
            {inv.terms_conditions && (
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>Terms &amp; Conditions</div>
                <div style={{ color: '#64748b', whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '11px' }}>{inv.terms_conditions}</div>
              </div>
            )}

            {/* Digital authorization: stamp + signature, no manual signing required */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: '16px' }}>
              {showStamp && (
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', width: '80px', height: '80px', flexShrink: 0, opacity: 0.9 }}>
                  <img src={stampSrc} alt="Company stamp" crossOrigin="anonymous" style={{ maxWidth: '80px', maxHeight: '80px', objectFit: 'contain' }} />
                </div>
              )}
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>Authorized By</div>
                {showSignature ? (
                  <div style={{ height: '52px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: '6px' }}>
                    <img
                      src={signatureSrc}
                      alt="Authorized signature"
                      crossOrigin="anonymous"
                      style={{ maxHeight: '48px', maxWidth: '180px', objectFit: 'contain' }}
                    />
                  </div>
                ) : (
                  <div style={{ height: '52px' }} />
                )}
                <div style={{ borderTop: `2px solid ${BRAND}`, paddingTop: '8px' }}>
                  {cfg.signature_name && <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b' }}>{cfg.signature_name}</div>}
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{cfg.signature_position || 'Authorized Representative'}</div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: BRAND, marginTop: '2px' }}>{companyName}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: BRAND, borderRadius: '0 0 16px 16px', padding: '18px 40px' }}>
            {cfg.invoice_footer_text && (
              <div style={{ color: 'white', fontSize: '13px', fontWeight: 600, marginBottom: '8px', textAlign: 'center' }}>
                {cfg.invoice_footer_text}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>
                {companyName}
                {cfg.company_registration_number ? ` • Reg. No: ${cfg.company_registration_number}` : ''}
                {' • Generated by RUNHTec Business Portal'}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', fontWeight: 600 }}>
                {inv.invoice_number} • {inv.invoice_date || new Date().toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
