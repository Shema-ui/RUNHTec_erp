// One consistent, professional layout for every email the ERP sends.
// Produces both an HTML version and a plain-text version from the same content.
const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CONTACT_LINE = 'RUNHTec Contractors Ltd · Kigali, Rwanda · +250 793 229 790 · contact@runhteccontractors.si';

function renderEmail({ greeting, paragraphs = [], details = [], steps = [], button = null, closing = [], signoff = 'Kind regards,\nRUNHTec Contractors Ltd', footnote = '' }) {
  // details: [[label, value], ...]   steps: [{ title, text }]   button: { label, url }
  const txt = [];
  txt.push(greeting, '');
  for (const p of paragraphs) txt.push(p, '');
  if (details.length) {
    for (const [k, v] of details) txt.push(`${k}: ${v}`);
    txt.push('');
  }
  steps.forEach((s, i) => { txt.push(`${i + 1}. ${s.title}`); if (s.text) txt.push(`   ${s.text}`); });
  if (steps.length) txt.push('');
  if (button) txt.push(`${button.label}: ${button.url}`, '');
  for (const c of closing) txt.push(c, '');
  txt.push(signoff, '', '--', CONTACT_LINE);
  if (footnote) txt.push(footnote);
  const text = txt.join('\n').replace(/\n{3,}/g, '\n\n');

  const para = (p) => `<p style="margin:0 0 14px">${esc(p)}</p>`;
  const detailRows = details.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 18px;border-collapse:collapse;font-size:14px">${details.map(([k, v]) => `<tr><td style="padding:4px 14px 4px 0;color:#6b7280;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;color:#1f2933;font-weight:600">${esc(v)}</td></tr>`).join('')}</table>`
    : '';
  const stepRows = steps.length
    ? `<ol style="margin:0 0 18px;padding-left:20px">${steps.map((s) => `<li style="margin:0 0 10px"><strong>${esc(s.title)}</strong>${s.text ? `<br><span style="color:#374151">${esc(s.text)}</span>` : ''}</li>`).join('')}</ol>`
    : '';
  const btn = button
    ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="display:inline-block;background:#881946;color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px">${esc(button.label)}</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px 12px">
<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">
  <div style="background:#881946;color:#ffffff;padding:20px 28px;font-size:18px;font-weight:bold;letter-spacing:.3px">RUNHTec Contractors Ltd</div>
  <div style="padding:28px;color:#1f2933;font-size:15px;line-height:1.6">
    ${para(greeting)}
    ${paragraphs.map(para).join('')}
    ${detailRows}
    ${stepRows}
    ${btn}
    ${closing.map(para).join('')}
    <p style="margin:18px 0 0;white-space:pre-line">${esc(signoff)}</p>
  </div>
  <div style="padding:16px 28px;background:#f9fafb;color:#6b7280;font-size:12px;line-height:1.6;border-top:1px solid #e5e7eb">
    ${esc(CONTACT_LINE)}${footnote ? `<br>${esc(footnote)}` : ''}
  </div>
</div></body></html>`;
  return { text, html };
}

module.exports = { renderEmail, esc };
