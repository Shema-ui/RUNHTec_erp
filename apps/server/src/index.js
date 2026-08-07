require('dotenv').config();

const express = require('express');
const cors = require('cors');

const { runMigrations } = require('./migrate');
const { attachUser } = require('./auth');
const authRoutes = require('./routes/auth');
const collectionsRoutes = require('./routes/collections');
const filesRoutes = require('./routes/files');
const websiteIntakeRoutes = require('./routes/websiteIntake');

const PORT = process.env.PORT || 8090;

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  await runMigrations();

  const app = express();
  app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));
  app.use(attachUser);

  app.get('/api/health', (req, res) => res.json({ message: 'API is healthy.', code: 200 }));

  app.use('/api/collections', authRoutes);
  app.use('/api/collections', collectionsRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api/website-intake', websiteIntakeRoutes);

  app.use((req, res) => res.status(404).json({ message: 'Not found.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ message: 'Internal server error.' });
  });

  app.listen(PORT, () => {
    console.log(`RUNHTec server listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
