require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const { authenticate, loadUser, apiKeyAuth } = require('./middleware/auth');
const { rateLimit } = require('./middleware/guards');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ---- Security headers (manual helmet-equivalent, no extra dependency) ----
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // No inline scripts/styles used by the PWA frontends — strict CSP is safe
    'Content-Security-Policy': (
      process.env.NODE_ENV === 'production'
        ? "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        : "default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws: http: https:; manifest-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    ),
  });
  next();
});

// CORS: explicit allowlist via CORS_ORIGINS; production defaults to same-origin only; dev allows all
const allowlist = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()) : null;
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true); // same-origin / server-to-server (curl, mobile app, Railway health checks)
    if (allowlist) return cb(allowlist.includes(origin) ? null : new Error('Origin not allowed'), allowlist.includes(origin));
    if (process.env.NODE_ENV === 'production') {
      // Frontend is served same-origin from this host — reject all cross-origin browser requests
      return cb(new Error('Origin not allowed'), false);
    }
    cb(null, true); // dev
  },
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
};
app.use(cors(corsOptions));
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
app.use('/api/platform', rateLimit(20, 60_000), require('./routes/platform'));

// ---- Protected routes ----
app.use('/api', (req, res, next) => {
  // X-Api-Key (read-only platform API) or Bearer JWT
  if (req.headers['x-api-key']) return apiKeyAuth(req, res, next);
  authenticate(req, res, next);
}, (req, res, next) => {
  if (req.apiKey) return next(); // synthetic identity from the API key
  loadUser(req, res, next);
}, (req, res, next) => {
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

// ---- Automated reminders (fees/overdue/absence via email/SMS/WhatsApp) ----
require('./scheduler').startScheduler();

// ---- Error handler ----
app.use((err, req, res, next) => {
  console.error('[api] error:', err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'Duplicate record', detail: err.detail });
  if (err.code === '23503') return res.status(400).json({ error: 'Related record does not exist' });
  if (err.status) return res.status(err.status).json({ error: err.message, code: err.code || undefined });
  // Unexpected errors: never leak internals to clients
  const message = process.env.NODE_ENV === 'production' ? 'Server error' : (err.message || 'Server error');
  res.status(err.status || 500).json({ error: message });
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
