const express = require('express');
const { getFile } = require('../files');

const router = express.Router();

// Public by design — file URLs are unguessable 20-char random ids, mirroring
// how PocketBase's own file URLs work (no auth check on the file itself,
// only on discovering its id via the owning, RBAC-protected record).
router.get('/:id', async (req, res) => {
  const file = await getFile(req.params.id);
  if (!file) return res.status(404).json({ message: 'File not found.' });
  res.setHeader('Content-Type', file.mimetype);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(file.data);
});

module.exports = router;
