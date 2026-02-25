import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import apiRoutes from './api/routes';
import { setupWebSocketHandlers } from './websocket/handlers';
import pool from './db/connection';
import { NotificationRepository } from './db/repositories/notification.repository';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Configure Socket.IO with permissive CORS
// Use /api/socket.io path to work with Dokploy proxy configuration
const io = new SocketIOServer(httpServer, {
  path: '/api/socket.io',
  serveClient: false,
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['*'],
    credentials: false
  },
  allowEIO3: true,
  transports: ['polling', 'websocket'],
  // Add Engine.IO options
  pingTimeout: 60000,
  pingInterval: 25000,
  // Increase max message size for large design system syncs (default: 1MB)
  maxHttpBufferSize: 50e6 // 50MB - supports enterprise design systems with 1000+ variables and components
});

// Add middleware to Socket.IO engine to manually set CORS headers
io.engine.on('headers', (headers: any, req: any) => {
  headers['Access-Control-Allow-Origin'] = '*';
  headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
  headers['Access-Control-Allow-Headers'] = '*';
  headers['Access-Control-Allow-Credentials'] = 'false';

  console.log(`🔧 Adding CORS headers to Socket.IO response for ${req.url}`);
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: false // Disable CORP to allow CORS
}));

// Custom CORS middleware (replaces cors package)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight for all routes
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '50mb' })); // Support large design system payloads

// Log Socket.IO requests for debugging
app.use((req, _res, next) => {
  if (req.url.startsWith('/socket.io')) {
    console.log(`🔌 Socket.IO request: ${req.method} ${req.url}`);
    console.log(`   Origin: ${req.headers.origin || 'none'}`);
  }
  next();
});

// API routes (includes /api/health)
app.use('/api', apiRoutes);

// Test endpoint for Socket.IO troubleshooting
app.get('/test-cors', (req, res) => {
  res.json({
    message: 'CORS test successful',
    origin: req.headers.origin || 'no origin',
    timestamp: new Date().toISOString()
  });
});

// WebSocket handlers
setupWebSocketHandlers(io);

// Run database migrations on startup
async function runMigrations() {
  const migrationFiles = [
    '001_add_variable_collections_and_fix_columns.sql',
    '002_add_auth_tables.sql',
    '003_workspace_scoped_unique_constraints.sql',
    '004_add_workspace_invitations.sql',
    '005_add_collection_figma_id.sql',
    '006_add_variable_figma_id.sql',
    '007_add_notifications.sql',
    '008_add_notification_preferences.sql',
  ];

  for (const file of migrationFiles) {
    try {
      console.log(`🔄 Running migration: ${file}...`);

      const possiblePaths = [
        join(__dirname, `../../../database/migrations/${file}`),
        join(__dirname, `../database/migrations/${file}`),
        join(process.cwd(), `database/migrations/${file}`),
      ];

      let migrationSQL: string | null = null;
      for (const p of possiblePaths) {
        try {
          migrationSQL = readFileSync(p, 'utf-8');
          console.log(`📄 Found migration at: ${p}`);
          break;
        } catch {
          // Try next path
        }
      }

      if (!migrationSQL) {
        console.log(`⚠️ Migration ${file} not found, skipping`);
        continue;
      }

      await pool.query(migrationSQL);
      console.log(`✅ Migration ${file} completed`);
    } catch (error) {
      console.error(`⚠️ Migration ${file} error (may be safe to ignore if already applied):`, error instanceof Error ? error.message : error);
    }
  }
}

// Periodic cleanup of expired notifications (read: 30 days, unread: 90 days)
function startNotificationCleanup() {
  const CLEANUP_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  const cleanup = async () => {
    try {
      const deleted = await NotificationRepository.cleanupExpired(30, 90);
      if (deleted > 0) {
        console.log(`🧹 Cleaned up ${deleted} expired notifications`);
      }
    } catch (error) {
      console.error('⚠️ Notification cleanup error:', error instanceof Error ? error.message : error);
    }
  };

  // Run once on startup then every 24h
  cleanup();
  setInterval(cleanup, CLEANUP_INTERVAL);
}

// Start server
async function startServer() {
  await runMigrations();
  startNotificationCleanup();

  httpServer.listen(PORT, () => {
    console.log('🚀 DS Agent Server Started');
    console.log(`📡 HTTP Server: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  });
}

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors to prevent server crash
process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('⚠️ Uncaught Exception:', error);
  // Don't exit - keep server running for other connections
});

export { app, io };
