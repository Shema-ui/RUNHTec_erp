// Solar kit builder in the ERP: preview a kit for any load, and create a draft quotation from it.
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');
const solarKit = require('../solarKit');

const router = express.Router();
// Buying prices are involved, so only staff who may see costs.
const CAN = ['super_admin', 'admin', 'sales', 'accountant', 'project_manager'];
const n = (v) => Number(v) || 0;

function loadFrom(body) {
  const l = body?.load || {};
  const load = {
    peakW: Math.min(n(l.peakW), 2e6), dailyWh: Math.min(n(l.dailyWh), 5e7), backupWh: Math.min(n(l.backupWh), 5e7),
    hours: Math.min(n(l.hours), 72), maxMotorW: Math.min(n(l.maxMotorW), 2e5), solar: l.solar !== false,
  };
  return load.peakW > 0 ? load : null;
}

// POST /api/solar-kit/preview {load}
router.post('/preview', requireAuth, async (req, res) => {
  if (!CAN.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const load = loadFrom(req.body);
  if (!load) return res.status(400).json({ message: 'Enter the peak load.' });
  try {
    const ctx = await solarKit.loadContext();
    const kit = solarKit.buildKit(load, ctx);
    const subtotal = kit.lines.reduce((t, l) => t + n(l.amount), 0);
    const cost = kit.lines.reduce((t, l) => t + n(l.cost) * n(l.quantity), 0);
    res.json({ ...kit, subtotal, cost, currency: ctx.currency, markup: ctx.markup });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

// POST /api/solar-kit/quote {load, rfq?, client?} — creates a draft quotation.
router.post('/quote', requireAuth, async (req, res) => {
  if (!CAN.includes(req.user.role)) return res.status(403).json({ message: 'Not allowed.' });
  const load = loadFrom(req.body);
  if (!load) return res.status(400).json({ message: 'Enter the peak load.' });
  try {
    let billTo = {}; let client = req.body?.client || null; const rfq = req.body?.rfq || null;
    if (rfq) {
      const [r] = await pool.query('SELECT * FROM rfqs WHERE id = ?', [rfq]);
      if (r[0]) { billTo = { name: r[0].name, company: r[0].company, address: r[0].address, email: r[0].email, phone: r[0].phone }; client = client || r[0].client; }
    }
    if (client && !billTo.company) {
      const [c] = await pool.query('SELECT company_name FROM clients WHERE id = ?', [client]);
      if (c[0]) billTo.company = c[0].company_name;
    }
    const q = await solarKit.createDraftQuote({ load, rfq, client, billTo, force: true });
    res.json({ id: q.id, number: q.number, missing: q.kit.missing });
  } catch (err) { res.status(400).json({ message: err.message }); }
});

module.exports = router;
