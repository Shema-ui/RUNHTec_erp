const express = require('express');
const { getFile } = require('../files');

const router = express.Router();

// Public by design — file URLs are unguessable 20-char random ids, mirroring
// how PocketBase's own file URLs work (no auth check on the file itself,
// only on discovering its id via the owning, RBAC-protected record).
router.get('/:id', async (req, res) => {
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
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(file.data);
});

module.exports = router;
