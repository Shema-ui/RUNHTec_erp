// Outgoing email without extra packages, using a FREE email service's web API.
// Set ONE of these on Render (Environment):
//   BREVO_API_KEY   — brevo.com free plan (300 emails/day). Also set MAIL_FROM
//                     to an address you verified in Brevo (e.g. your Gmail).
//   RESEND_API_KEY  — resend.com free plan. MAIL_FROM must be on a domain you
//                     verified in Resend.
// MAIL_FROM_NAME is optional (defaults to "RUNHTec Contractors").
// With neither key set, email is simply switched off and nothing breaks.

const FROM = () => process.env.MAIL_FROM || '';
const FROM_NAME = () => process.env.MAIL_FROM_NAME || 'RUNHTec Contractors';

function emailEnabled() {
  return Boolean(FROM() && (process.env.BREVO_API_KEY || process.env.RESEND_API_KEY));
}

async function sendEmail({ to, subject, text, html }) {
  if (!emailEnabled() || !to) return false;
  try {
    let res;
    if (process.env.BREVO_API_KEY) {
      res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender: { email: FROM(), name: FROM_NAME() }, to: [{ email: to }], subject, textContent: text, htmlContent: html || `<pre style="font-family:inherit">${String(text).replace(/</g, '&lt;')}</pre>` }),
      });
    } else {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from: `${FROM_NAME()} <${FROM()}>`, to: [to], subject, text, html }),
      });
    }
    if (!res.ok) { console.error('email failed:', res.status, (await res.text()).slice(0, 300)); return false; }
    return true;
  } catch (err) {
    console.error('email failed:', err.message);
    return false;
  }
}

module.exports = { emailEnabled, sendEmail };
