// Staff framework agreement signed in the app during registration.
// DRAFT v1 for use until it is reviewed by a lawyer. Each signed contract stores
// its own copy of the wording, so changing this file never changes a signed one.
const CONTRACT_VERSION = '2026.11-draft1';

function renderContract({ name, nationalId, phone, role, date }) {
  const who = [name || '________________', nationalId ? `National ID ${nationalId}` : null, phone ? `phone ${phone}` : null].filter(Boolean).join(', ');
  const roleText = role || 'Technician';
  const title = 'RUNHTec Contractors Ltd — Professional Engagement and Confidentiality Agreement';
  const clauses = [
    ['Parties', `This agreement is between RUNHTec Contractors Ltd ("RUNHTec") and ${who} ("the Professional"). The Professional is registered as ${roleText}.`],
    ['Purpose', 'This agreement sets out how the Professional works with RUNHTec and how RUNHTec protects client, project and business information. Registration does not guarantee work or income.'],
    ['Independent contractor', 'The Professional works as an independent contractor and not as an employee. Each project is a separate engagement, agreed in writing in an engagement letter that states the scope, fee, dates and any equipment or transport arrangements. The Professional is responsible for their own tax and insurance obligations unless the engagement letter says otherwise.'],
    ['Offers and acceptance', 'RUNHTec may offer projects through the Business Portal. The Professional may accept or decline any offer. Once an offer is accepted, the engagement letter for that project applies.'],
    ['Confidential information', 'Client details, project information, quotations, buying prices, costs, margins, profit, supplier and vendor names and internal notes are confidential. The Professional must not copy, share, sell or use them except for the work they are assigned, and must not disclose them to any client, supplier or other third party.'],
    ['Limited access', 'The Professional sees only the information needed for projects they are assigned to or have accepted. Trying to open other records, or sharing a login, is a breach of this agreement.'],
    ['Working directly with clients', 'The Professional must not approach RUNHTec clients to offer or take work outside RUNHTec while a project is in progress, and must not take a client away from RUNHTec for work they were introduced to through RUNHTec.'],
    ['Personal data', 'RUNHTec collects and uses personal information only to manage registration, projects and payments. The Professional must handle any client or colleague personal data carefully and as required by Rwanda\'s data protection law.'],
    ['Safety and conduct', 'The Professional must follow site safety rules, use the protective equipment required for the work, behave respectfully toward clients and colleagues, and must not attend site under the influence of alcohol or drugs.'],
    ['Records', 'The Professional must record work days, expenses and receipts accurately in the Business Portal and keep original receipts for expenses they incur.'],
    ['Electronic signature', 'The Professional agrees that typing their full name and drawing their signature in the Business Portal is their legal signature on this agreement, and that the date, time and signature saved with it form a valid record.'],
    ['Ending the agreement', 'Either party may end this framework agreement by giving 7 days\' written notice. Any project engagement already accepted continues under its own engagement letter until that project is completed or ended.'],
    ['Governing law', 'This agreement is governed by the laws of the Republic of Rwanda. The parties will first try to resolve any dispute by discussion. If that fails, the courts of Kigali have jurisdiction.'],
    ['Acceptance', 'By signing, the Professional confirms they have read and understood this agreement and agrees to it.'],
  ];
  const body = clauses.map(([h, t], i) => `${i + 1}. ${h}\n${t}`).join('\n\n');
  return { title, version: CONTRACT_VERSION, body: `${body}\n\nDate: ${date || ''}` };
}

module.exports = { renderContract, CONTRACT_VERSION };
