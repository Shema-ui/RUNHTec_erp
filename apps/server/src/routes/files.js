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
  // Voice notes from the client app play in the page.
  const AUDIO = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/x-m4a', 'audio/wav', 'audio/x-wav'];
  const type = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
  const inline = INLINE.includes(type) || AUDIO.includes(type);
  const safeName = String(file.filename || 'file').replace(/[^A-Za-z0-9._ -]/g, '_').slice(0, 120);
  res.setHeader('Content-Type', inline ? type : 'application/octet-stream');
  res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.setHeader('Accept-Ranges', 'bytes');
  // iPhones ask for audio in pieces ("Range"); answer with just that piece.
  const data = Buffer.isBuffer(file.data) ? file.data : Buffer.from(file.data || '');
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, data.length - Number(m[2]));
    let end = m[1] && m[2] ? Math.min(Number(m[2]), data.length - 1) : data.length - 1;
    if (start >= data.length || start > end) { res.setHeader('Content-Range', `bytes */${data.length}`); return res.status(416).end(); }
    res.status(206);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`);
    return res.send(data.subarray(start, end + 1));
  }
  res.send(data);
});

module.exports = router;
