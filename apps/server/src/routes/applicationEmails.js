// Emails applicants when their application moves to a new stage.
// Sent in the background: a mail problem never blocks the HR update.
const { sendEmail } = require('../mailer');
const { renderEmail } = require('../emailLayout');
const { ensureStaffAccount } = require('../staffAccess');
const { getStaffKey, staffLink } = require('../staffKey');

const APP_URL = process.env.APP_URL || 'https://erp.runhteccontractors.si';

// Stage emails. Each is short, says what happened and what the applicant needs to do.
const STAGES = {
  shortlisted: {
    subject: 'Your application has been shortlisted',
    paragraphs: [
      'Good news: your application has been shortlisted by our HR team.',
      'We will contact you by phone or email to discuss the next steps. Please keep your phone switched on and check your email regularly.',
    ],
  },
  interview: {
    subject: 'Next step: interview or skills test',
    paragraphs: [
      'Your application has moved to the interview or skills test stage.',
      'Our HR team will contact you by phone or email with the date, time and location, and anything you need to bring.',
    ],
  },
  on_hold: {
    subject: 'Your application is on hold',
    paragraphs: [
      'Your application is on hold for now. We will keep your details on file and contact you if a suitable project comes up.',
      'No action is needed from you at this stage.',
    ],
  },
  rejected: {
    subject: 'Update on your application',
    paragraphs: [
      'Thank you for applying to RUNHTec Contractors and for your interest in working with us.',
      'We are not able to take your application further at this time. We keep applications on file and may contact you when a suitable project comes up.',
    ],
  },
};

function welcomeEmail(name, ref, link) {
  return renderEmail({
    greeting: `Dear ${name},`,
    paragraphs: [
      `We are pleased to let you know that your application (reference ${ref}) has been approved. You are now on our register of technical professionals.`,
      'Being on the register does not guarantee work. We offer projects that match your skills one at a time, and we confirm each one in writing before you start.',
      'To get started, please follow the steps below.',
    ],
    steps: [
      { title: 'Install the RUNHTec app', text: `Open ${APP_URL}/app for instructions. A QR code on that page can be scanned with your phone camera.` },
      { title: 'Open the staff sign-in page', text: link ? 'Tap the "Open staff sign-in" button below. The page opens by itself, so you do not need to paste anything.' : 'Our team will send your staff link shortly.' },
      { title: 'Sign in', text: 'Enter the email address this message was sent to, and the password our team sends you on WhatsApp. Then tap "Sign in".' },
      { title: 'If the button does not open the page', text: `Go to ${APP_URL}/login, tap "RUNHTec staff? Open your staff link" at the bottom of the page, paste the link from this email into "Paste your private staff link", then tap "Continue to staff sign-in". See the picture: ${APP_URL}/help/staff-link-login.png` },
    ],
    button: link ? { label: 'Open staff sign-in', url: link } : null,
    closing: [
      'Please keep your staff link and password private. Do not use the public client sign-up page, which is for clients only.',
      'If you need help, reply to this email or WhatsApp us on +250 793 229 790.',
    ],
    signoff: 'Kind regards,\nHuman Resources, RUNHTec Contractors Ltd',
  });
}

async function announceApplicationStatus(before, after) {
  if (!before || !after || before.status === after.status) return;
  if (!after.email) return;
  const ref = after.ref || '';
  const name = after.full_name || 'there';

  if (after.status === 'approved') {
    let link = '';
    try {
      await ensureStaffAccount(after);
      link = staffLink(await getStaffKey());
    } catch (err) {
      console.error('staff account setup failed:', err.message);
    }
    const m = welcomeEmail(name, ref, link);
    sendEmail({ to: after.email, subject: `Welcome to RUNHTec: your application is approved (${ref})`, text: m.text, html: m.html })
      .catch((err) => console.error('approval email failed:', err.message));
    return;
  }

  const stage = STAGES[after.status];
  if (!stage) return;
  const m = renderEmail({
    greeting: `Dear ${name},`,
    paragraphs: [...stage.paragraphs],
    details: [['Reference', ref]],
    signoff: 'Kind regards,\nHuman Resources, RUNHTec Contractors Ltd',
  });
  sendEmail({ to: after.email, subject: `${stage.subject} (${ref})`, text: m.text, html: m.html })
    .catch((err) => console.error('application status email failed:', err.message));
}

module.exports = { announceApplicationStatus };
