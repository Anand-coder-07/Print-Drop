require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// --- Middleware ---

// Security headers (relaxed CSP for inline scripts/styles and socket.io)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
});
app.use(sessionMiddleware);

// Share session with Socket.IO
io.engine.use(sessionMiddleware);

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// --- Routes ---

const authRoutes = require('./routes/auth');
const uploadRoutes = require('./routes/upload');
const dashboardRoutes = require('./routes/dashboard');

// Pass Socket.IO instance to routes
uploadRoutes.setIo(io);
dashboardRoutes.setIo(io);

app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/uploads', dashboardRoutes);

// --- Socket.IO ---

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// --- Generate QR Code ---

async function generateQR() {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const qrPath = path.join(__dirname, 'public', 'qr.png');

  try {
    await QRCode.toFile(qrPath, baseUrl, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
    });
    console.log(`📱 QR code generated → ${qrPath}`);
    console.log(`   Points to: ${baseUrl}`);
  } catch (err) {
    console.error('Failed to generate QR code:', err.message);
  }
}

// --- Start Server (async to allow DB init) ---

async function start() {
  // Initialize database (async because sql.js needs to load WASM)
  const { initDb } = require('./db');
  await initDb();
  console.log('✅ Database initialized');

  // Start auto-cleanup cron
  const { startCleanupJob, setIo: setCleanupIo } = require('./utils/cleanup');
  setCleanupIo(io);
  startCleanupJob();

  // Generate QR code
  await generateQR();

  // Start listening
  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════════╗');
    console.log('║            🖨️  PrintDrop Server                  ║');
    console.log('╠══════════════════════════════════════════════════╣');
    console.log(`║  Student Upload:  http://localhost:${PORT}            ║`);
    console.log(`║  Owner Login:     http://localhost:${PORT}/login.html  ║`);
    console.log(`║  Dashboard:       http://localhost:${PORT}/dashboard.html  ║`);
    console.log('╚══════════════════════════════════════════════════╝');
    console.log('');
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
