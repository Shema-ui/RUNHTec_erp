// Emails applicants when their application moves to a new stage.
// Sent in the background: a mail problem never blocks the HR update.
const { sendEmail } = require('../mailer');

const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SIGN = 'RUNHTec Contractors Ltd · WhatsApp +250 793 229 790';

const STAGES = {
  shortlisted: {
    subject: 'Your application is shortlisted',
    body: 'Good news: your application has been shortlisted by our HR team. We will contact you on the phone or email you gave to talk about next steps.',
  },
  interview: {
    subject: 'Next step: interview or skills test',
    body: 'Your application has moved to the interview or skills test stage. Our HR team will contact you on the phone or email you gave with the date, place and what to bring.',
  },
  on_hold: {
    subject: 'Your application is on hold',
    body: 'Your application is currently on hold. We will keep your details on file and contact you if a suitable project comes up.',
  },
  approved: {
    subject: 'You are approved on the RUNHTec register',
    body: 'Your application has been approved. You are now on our register of technical professionals. Being on the register does not guarantee work: we will offer you projects that match your skills, one at a time, and will confirm each one in writing before you start.',
  },
  rejected: {
    subject: 'Update on your RUNHTec application',
    body: 'Thank you for applying and for your interest in RUNHTec. We are not able to take your application further at this time. We keep applications on file and may contact you when a suitable project comes up.',
  },
};

const APP_URL = process.env.APP_URL || 'https://erp.runhteccontractors.si';

const WELCOME_TEXT = (name, ref) => `Dear ${name},

Congratulations. Your application (reference ${ref}) has been approved, and you are now on the RUNHTec register of technical professionals.

Being on the register does not guarantee work. We offer projects that match your skills one at a time, and we confirm each one in writing before you start.

HOW TO GET STARTED

1. Install the RUNHTec app on your phone
   Open ${APP_URL}/app and follow the steps there, or scan the QR code on that page with your phone camera.

2. Create your account (first time only)
   Go to ${APP_URL}/join and sign up using THIS email address, so your account matches your application.

3. Log in to the staff portal
   Go to ${APP_URL}/login, enter your email and password, and tap Log in.

4. Offer your services
   Open Project Offers in the app to see open projects that match your skills.

Need help? WhatsApp +250 793 229 790.

${SIGN}`;

const WELCOME_HTML = (name, ref) => `
<p>Dear ${esc(name)},</p>
<p><strong>Congratulations.</strong> Your application (reference <strong>${esc(ref)}</strong>) has been approved, and you are now on the RUNHTec register of technical professionals.</p>
<p>Being on the register does not guarantee work. We offer projects that match your skills one at a time, and we confirm each one in writing before you start.</p>
<h3 style="margin:22px 0 8px">How to get started</h3>
<ol style="padding-left:20px;line-height:1.6">
  <li><strong>Install the RUNHTec app.</strong> <a href="${APP_URL}/app">Open the install page</a> and follow the steps, or scan the QR code on it with your phone camera.</li>
  <li><strong>Create your account</strong> (first time only). <a href="${APP_URL}/join">Sign up here</a> using <u>this same email address</u>, so your account matches your application.</li>
  <li><strong>Log in to the staff portal.</strong> <a href="${APP_URL}/login">Log in here</a> with your email and password.</li>
  <li><strong>Offer your services.</strong> Open <em>Project Offers</em> in the app to see open projects that match your skills.</li>
</ol>
<p style="margin:22px 0"><a href="${APP_URL}/login" style="background:#881946;color:#ffffff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Log in to the staff portal</a></p>
<p>Need help? WhatsApp +250 793 229 790.</p>
<p>${esc(SIGN)}</p>`;

async function announceApplicationStatus(before, after) {
  if (!before || !after || before.status === after.status) return;
  if (!after.email) return;
  const ref = after.ref || '';
  const name = after.full_name || 'there';
  if (after.status === 'approved') {
    sendEmail({
      to: after.email,
      subject: `Welcome to RUNHTec: you are approved (${ref})`,
      text: WELCOME_TEXT(name, ref),
      html: WELCOME_HTML(name, ref),
    }).catch((err) => console.error('approval email failed:', err.message));
    return;
  }
  const stage = STAGES[after.status];
  if (!stage) return;
  sendEmail({
    to: after.email,
    subject: `RUNHTec: ${stage.subject} (${ref})`,
    text: `Dear ${name},\n\n${stage.body}\n\nYour reference: ${ref}\n\n${SIGN}`,
    html: `<p>Dear ${esc(name)},</p><p>${esc(stage.body)}</p><p>Your reference: <strong>${esc(ref)}</strong></p><p>${esc(SIGN)}</p>`,
  }).catch((err) => console.error('application status email failed:', err.message));
}

module.exports = { announceApplicationStatus };
