require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const { authenticate, loadUser } = require('./middleware/auth');
const { rateLimit } = require('./middleware/guards');

const app = express();
app.set('trust proxy', 1);
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// ---- Public routes ----
app.get('/api/health', async (req, res) => {
  try {
    const { query } = require('./db');
    await query('SELECT 1');
    res.json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

app.use('/api/auth', rateLimit(30, 60_000), require('./routes/auth'));
app.use('/api/public', rateLimit(60, 60_000), require('./routes/public'));

// ---- Protected routes ----
app.use('/api', authenticate, loadUser, (req, res, next) => {
  // shared router mounting below
  next();
});

const routes = {
  '/api/super': 'super',
  '/api/tenants': 'tenants',
  '/api/config': 'config',
  '/api/branches': 'branches',
  '/api/students': 'students',
  '/api/parents': 'parents',
  '/api/teachers': 'teachers',
  '/api/groups': 'groups',
  '/api/schedules': 'schedules',
  '/api/enrollments': 'enrollments',
  '/api/attendance': 'attendance',
  '/api/homework': 'homework',
  '/api/materials': 'materials',
  '/api/questions': 'questions',
  '/api/quizzes': 'quizzes',
  '/api/assessments': 'assessments',
  '/api/gradebook': 'gradebook',
  '/api/fees': 'fees',
  '/api/payments': 'payments',
  '/api/leads': 'leads',
  '/api/notifications': 'notifications',
  '/api/announcements': 'announcements',
  '/api/dashboard': 'dashboard',
  '/api/reports': 'reports',
  '/api/portal': 'portal',
  '/api/search': 'search',
  '/api/insights': 'insights',
};

for (const [prefix, name] of Object.entries(routes)) {
  app.use(prefix, require(`./routes/${name}`));
}

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error('[api] error:', err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'Duplicate record', detail: err.detail });
  if (err.code === '23503') return res.status(400).json({ error: 'Related record does not exist' });
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// ---- Serve frontend (PWA portals) ----
const webPublic = path.join(__dirname, '..', '..', 'web', 'public');
const webDist = path.join(__dirname, '..', '..', 'web', 'dist');
const staticDir = fs.existsSync(webDist) ? webDist : webPublic;
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(staticDir, 'index.html')));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[server] EduCenter OS API listening on :${PORT}`));

module.exports = app;
