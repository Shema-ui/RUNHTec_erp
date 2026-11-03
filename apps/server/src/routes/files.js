const express = require('express');
const { getFile } = require('../files');
const { userFromToken } = require('../auth');

const router = express.Router();

// Files (ID copies, CVs, photos…) are only served to signed-in staff. Images
// and links can't send a header, so the ERP adds the sign-in token to the link.
router.get('/:id', async (req, res) => {
  const user = req.user || await userFromToken(String(req.query.token || ''));
  if (!user) return res.status(401).json({ message: 'Please sign in to the ERP to open this file.' });
  const file = await getFile(req.params.id);
  if (!file) return res.status(404).json({ message: 'File not found.' });
  // Only common image types and PDFs are shown in the browser; anything else
  // (HTML, SVG, scripts…) is downloaded as a file so it can never run as a
  // page. The sandbox policy blocks scripts even if a browser tried.
  const INLINE = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf'];
  const type = String(file.mimetype || '').toLowerCase();
  const inline = INLINE.includes(type);
  const safeName = String(file.filename || 'file').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120);
  res.setHeader('Content-Type', inline ? type : 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.send(file.data);
});

module.exports = router;
