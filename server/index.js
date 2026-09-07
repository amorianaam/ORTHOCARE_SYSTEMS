require('dotenv').config();
const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const cors  = require('cors');
const cron  = require('node-cron');
const { exec } = require('child_process');
const path  = require('path');
const fs    = require('fs');

const app    = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────
const io = new Server(server, { cors: { origin: '*' } });
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Auto DB Migration ──────────────────────────────
// Migration scripts have been moved to server/scripts/migrate.js

// ── Routes ────────────────────────────────────────────────────────
const authRoutes = require('./routes/authRoutes');
const apiRoutes  = require('./routes/apiRoutes');

app.use('/api/auth', authRoutes);
app.use('/api',      apiRoutes);

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', message: 'ORTHOCARE Backend is running' })
);

// ── Socket.IO Rooms ───────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.on('join-role', (role) => {
    socket.join(role);
    console.log(`[Socket] ${socket.id} joined room: ${role}`);
  });
  socket.on('disconnect', () => console.log(`[Socket] Disconnected: ${socket.id}`));
});

// ── Auto Backup (daily at 2 AM) ───────────────────────────────────
const backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');

function runBackup() {
  if (!fs.existsSync(backupDir)) {
    try { fs.mkdirSync(backupDir, { recursive: true }); } catch (e) { return; }
  }
  const ts   = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const file = path.join(backupDir, `orthocare-${ts}.sql`);
  const db   = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    pass: process.env.DB_PASS || '',
    name: process.env.DB_NAME || 'orthocare',
  };
  const cmd  = `${fs.existsSync('C:\\xampp\\mysql\\bin\\mysqldump.exe') ? '"C:\\xampp\\mysql\\bin\\mysqldump.exe"' : 'mysqldump'} -h ${db.host} -u ${db.user} ${db.pass ? `-p${db.pass}` : ''} ${db.name} > "${file}"`;
  exec(cmd, (err) => {
    if (err) {
      console.error('[Backup] Failed:', err.message);
      io.to('doctor').emit('backup:failed', { message: 'فشل النسخ الاحتياطي التلقائي: تأكد من مسار mysqldump' });
    } else {
      console.log('[Backup] Success:', file);
      io.to('doctor').emit('backup:done', { file: path.basename(file), message: 'تم النسخ الاحتياطي بنجاح' });
    }
  });
}

// Run daily at 02:00 AM
cron.schedule('0 2 * * *', () => {
  console.log('[Backup] Starting scheduled backup...');
  runBackup();
});

// Expose manual trigger route
app.post('/api/admin/backup/now', (req, res) => {
  runBackup();
  res.json({ message: 'جاري تنفيذ النسخ الاحتياطي...' });
});

// ── Start Server ──────────────────────────────────────────────────
const PORT = process.env.SERVER_PORT || 5000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
