import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Edit2, Printer, ChevronLeft, Loader2, Download, ArrowRight } from 'lucide-react';
import pb from '@/lib/pocketbaseClient';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_LOGO_URL = 'https://horizons-cdn.hostinger.com/2757b26b-44c6-4111-a4b2-af6d71351715/f9d1fad541d7f3b6fd43d5a1326794e7.jpg';
const DEFAULT_COMPANY_NAME = 'RUNHTec Contractors';
const BRAND = '#003DA5';

const STATUS_COLORS = {
  draft:    { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
  sent:     { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  accepted: { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  declined: { bg: '#fff1f2', text: '#be123c', border: '#fecdd3' },
  expired:  { bg: '#f9fafb', text: '#6b7280', border: '#e5e7eb' },
};

function fmt(n, currency = 'ZAR') {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: currency || 'ZAR', minimumFractionDigits: 2 }).format(n || 0);
}

const PRINT_STYLE = `
@media print {
  body * { visibility: hidden !important; }
  #quote-print, #quote-print * { visibility: visible !important; }
  #quote-print { position: fixed; left: 0; top: 0; width: 210mm; background: white; }
  .no-print { display: none !important; }
  @page { size: A4; margin: 0; }
}
`;

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
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image') && dataUrl.length > 100) return dataUrl;
    }
  } catch (_) { /* fall through to canvas method */ }
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 240;
    canvas.height = img.naturalHeight || 240;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    if (dataUrl && dataUrl.length > 100) return dataUrl;
  } catch (_) { /* give up, caller falls back to remote url */ }
  return null;
}

export default function QuotationViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quote, setQuote] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logoEmbed, setLogoEmbed] = useState(null);

  useEffect(() => {
    Promise.all([
      pb.collection('quotations').getOne(id, { requestKey: `view-quote-${id}` }),
      pb.collection('company_settings').getList(1, 1, { requestKey: 'view-quote-settings' })
        .then(r => r.items[0] || null).catch(() => null),
    ]).then(([q, cfg]) => {
      setQuote(q);
      setSettings(cfg);
      setLoading(false);
    }).catch(() => navigate('/quotations'));
  }, [id]);

  const logoUrl = settings?.logo ? pb.files.getURL(settings, settings.logo) : DEFAULT_LOGO_URL;

  useEffect(() => {
    let cancelled = false;
    toBase64Image(logoUrl).then((data) => { if (!cancelled) setLogoEmbed(data || logoUrl); });
    return () => { cancelled = true; };
  }, [logoUrl]);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      let embed = logoEmbed;
      if (!String(embed).startsWith('data:image')) {
        embed = (await toBase64Image(logoUrl)) || logoUrl;
        setLogoEmbed(embed);
        await new Promise((r) => setTimeout(r, 150));
      }
      const el = document.getElementById('quote-print');
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
      pdf.save(`${quote?.number || 'quotation'}.pdf`);
    } catch (e) {
      alert('PDF generation failed: ' + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleStatusChange = async (status) => {
    try {
      const updated = await pb.collection('quotations').update(id, { status });
      setQuote(updated);
    } catch (e) { alert(e.message); }
  };

  const convertToProject = async () => {
    setBusy(true);
    try {
      const project = await pb.collection('projects').create({
        quotation: quote.id,
        client: quote.client || null,
        title: `${quote.bill_to_company || quote.bill_to_name || 'Project'} — ${quote.number}`,
        status: 'scheduled',
        site_address: quote.bill_to_address || '',
      });
      toast({ title: 'Project created', description: 'The accepted quotation is now an active project.' });
      navigate(`/projects`);
      void project;
    } catch (e) {
      toast({ title: 'Could not create project', description: e.message, variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const q = quote;
  const cfg = settings || {};
  const items = Array.isArray(q.items) ? q.items : [];
  const statusColor = STATUS_COLORS[q.status] || STATUS_COLORS.draft;
  const currency = q.currency || cfg.currency || 'ZAR';
  const statusLabel = q.status ? q.status.charAt(0).toUpperCase() + q.status.slice(1) : 'Draft';
  const companyName = cfg.company_name || DEFAULT_COMPANY_NAME;
  const logoSrc = logoEmbed || logoUrl;
  const cardLabel = { fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', marginBottom: '10px' };

  return (
    <div className="min-h-[100dvh] bg-slate-100">
      <style>{PRINT_STYLE}</style>
      <Helmet>
        <title>{q.number} | RUNHTec Quotation</title>
        <meta name="description" content={`Quotation ${q.number} from ${companyName}`} />
      </Helmet>

      {/* Toolbar */}
      <div className="no-print sticky top-0 z-20 border-b border-border bg-white/95 backdrop-blur-sm px-4 py-3 shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2">
          <Link to="/quotations" className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-slate-50">
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
            value={q.status || 'draft'}
            onChange={e => handleStatusChange(e.target.value)}
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
          <div className="ml-auto flex gap-2">
            {q.status === 'accepted' && (
              <button
                onClick={convertToProject}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Convert to project
              </button>
            )}
            <Link
              to={`/quotations/${id}/edit`}
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

      {/* A4 Quotation */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div
          id="quote-print"
          className="rounded-2xl bg-white shadow-xl"
          style={{ fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif", fontSize: '13px', lineHeight: '1.5', color: '#1e293b' }}
        >
          {/* Header */}
          <div style={{ background: BRAND, borderRadius: '16px 16px 0 0', padding: '32px 40px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
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
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'white', fontWeight: 900, fontSize: '34px', letterSpacing: '-1px', lineHeight: 1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                  QUOTATION
                </div>
                <div style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, fontSize: '15px', marginTop: '4px', fontFamily: 'monospace' }}>
                  {q.number}
                </div>
                <div style={{ marginTop: '8px', display: 'inline-block', background: statusColor.bg, color: statusColor.text, border: `1px solid ${statusColor.border}`, borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>
                  {statusLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Meta row */}
          <div style={{ background: '#f8fafc', padding: '20px 40px', borderBottom: '1px solid #e2e8f0', display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
            {[
              { label: 'Quotation Number', value: q.number || '—' },
              { label: 'Date Issued', value: q.created ? new Date(q.created).toLocaleDateString() : '—' },
              { label: 'Valid Until', value: q.valid_until || '—' },
              { label: 'Status', value: statusLabel },
            ].map(m => (
              <div key={m.label}>
                <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '2px' }}>{m.label}</div>
                <div style={{ fontWeight: 600, fontSize: '13px' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Bill To / From */}
          <div style={{ padding: '28px 40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
              <div style={cardLabel}>Prepared For</div>
              {q.bill_to_name && <div style={{ fontWeight: 700, fontSize: '15px' }}>{q.bill_to_name}</div>}
              {q.bill_to_company && <div style={{ fontWeight: q.bill_to_name ? 500 : 700, fontSize: q.bill_to_name ? '13px' : '15px', color: q.bill_to_name ? '#475569' : '#1e293b' }}>{q.bill_to_company}</div>}
              {q.bill_to_address && <div style={{ color: '#64748b', marginTop: '4px', whiteSpace: 'pre-line' }}>{q.bill_to_address}</div>}
              {q.bill_to_email && <div style={{ color: '#64748b', marginTop: '4px' }}>{q.bill_to_email}</div>}
              {q.bill_to_phone && <div style={{ color: '#64748b' }}>{q.bill_to_phone}</div>}
              {!q.bill_to_name && !q.bill_to_company && <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>No client specified</div>}
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '18px 20px' }}>
              <div style={cardLabel}>Prepared By</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>{companyName}</div>
              {cfg.company_registration_number && <div style={{ color: '#94a3b8', fontSize: '11px', marginTop: '2px' }}>Reg. No: {cfg.company_registration_number}</div>}
              {cfg.company_address && <div style={{ color: '#64748b', marginTop: '4px', whiteSpace: 'pre-line' }}>{cfg.company_address}</div>}
              {cfg.company_phone && <div style={{ color: '#64748b', marginTop: '4px' }}>{cfg.company_phone}</div>}
              {cfg.company_email && <div style={{ color: '#64748b' }}>{cfg.company_email}</div>}
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <div style={{ width: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                  <span style={{ color: '#64748b' }}>Subtotal</span>
                  <span style={{ fontWeight: 500 }}>{fmt(q.subtotal, currency)}</span>
                </div>
                {q.discount_amount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>Discount</span>
                    <span style={{ fontWeight: 500, color: '#16a34a' }}>-{fmt(q.discount_amount, currency)}</span>
                  </div>
                )}
                {q.tax_rate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #e2e8f0', fontSize: '13px' }}>
                    <span style={{ color: '#64748b' }}>VAT / Tax ({q.tax_rate}%)</span>
                    <span style={{ fontWeight: 500 }}>{fmt(q.tax_amount, currency)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '12px 14px', marginTop: '6px', background: BRAND, borderRadius: '8px' }}>
                  <span style={{ color: 'white', fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Total</span>
                  <span style={{ color: 'white', fontWeight: 800, fontSize: '19px' }}>{fmt(q.total, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {(q.notes || q.terms_conditions) && (
            <div style={{ padding: '0 40px 32px', display: 'grid', gridTemplateColumns: q.notes && q.terms_conditions ? '1fr 1fr' : '1fr', gap: '24px', borderTop: '1px solid #e2e8f0', paddingTop: '24px' }}>
              {q.notes && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>Notes</div>
                  <div style={{ color: '#475569', whiteSpace: 'pre-line', lineHeight: '1.6' }}>{q.notes}</div>
                </div>
              )}
              {q.terms_conditions && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', marginBottom: '8px' }}>Terms &amp; Conditions</div>
                  <div style={{ color: '#64748b', whiteSpace: 'pre-line', lineHeight: '1.6', fontSize: '11px' }}>{q.terms_conditions}</div>
                </div>
              )}
            </div>
          )}

          {/* Footer */}
          <div style={{ background: BRAND, borderRadius: '0 0 16px 16px', padding: '14px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px' }}>
              {companyName}{cfg.company_registration_number ? ` • Reg. No: ${cfg.company_registration_number}` : ''} • Generated by RUNHTec Business Portal
            </div>
            <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '11px', fontWeight: 600 }}>
              {q.number} • {q.created ? new Date(q.created).toLocaleDateString() : new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
