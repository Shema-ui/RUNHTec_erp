// A worker's project cards: every job they are on, with no prices, values, costs,
// notes or client name. Built from the projects themselves, so nothing is lost.
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();

function parseTeam(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch (_) { return []; } }
  return [];
}

// GET /api/work-history/me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const me = req.user.id;
    const [rows] = await pool.query(
      `SELECT p.id, p.code, p.title, p.service_category, p.status, p.start_date, p.due_date, p.completed_date,
              p.description, p.assigned_technicians, p.lead_technician, c.district, c.city
         FROM projects p LEFT JOIN clients c ON c.id = p.client
        WHERE p.status <> 'cancelled'
        ORDER BY COALESCE(p.start_date, p.created) DESC`
    );
    const mine = rows.filter((p) => parseTeam(p.assigned_technicians).includes(me) || p.lead_technician === me);
    const ids = mine.map((p) => p.id);
    const photos = {};
    if (ids.length) {
      const [pc] = await pool.query(`SELECT project, COUNT(*) AS n FROM project_photos WHERE project IN (${ids.map(() => '?').join(', ')}) GROUP BY project`, ids);
      pc.forEach((r) => { photos[r.project] = Number(r.n) || 0; });
    }
    const items = mine.map((p) => {
      const team = parseTeam(p.assigned_technicians);
      const text = String(p.description || '').replace(/\s+/g, ' ').trim();
      return {
        id: p.id,
        code: p.code || '',
        title: p.title,
        category: p.service_category || '',
        status: p.status,
        role: p.lead_technician === me ? 'Lead technician' : 'Technician',
        start: p.start_date || '',
        end: p.completed_date || p.due_date || '',
        area: [p.district, p.city].filter(Boolean).join(', '),
        summary: text.length > 320 ? `${text.slice(0, 317)}…` : text,
        team_size: new Set([...team, p.lead_technician].filter(Boolean)).size,
        photos: photos[p.id] || 0,
      };
    });
    res.json({ items });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;
