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

async function announceApplicationStatus(before, after) {
  if (!before || !after || before.status === after.status) return;
  const stage = STAGES[after.status];
  if (!stage || !after.email) return;
  const ref = after.ref || '';
  const name = after.full_name || 'there';
  sendEmail({
    to: after.email,
    subject: `RUNHTec: ${stage.subject} (${ref})`,
    text: `Dear ${name},\n\n${stage.body}\n\nYour reference: ${ref}\n\n${SIGN}`,
    html: `<p>Dear ${esc(name)},</p><p>${esc(stage.body)}</p><p>Your reference: <strong>${esc(ref)}</strong></p><p>${esc(SIGN)}</p>`,
  }).catch((err) => console.error('application status email failed:', err.message));
}

module.exports = { announceApplicationStatus };
