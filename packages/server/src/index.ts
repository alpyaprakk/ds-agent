import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import dotenv from 'dotenv';
import apiRoutes from './api/routes';
import { setupWebSocketHandlers } from './websocket/handlers';

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
  pingInterval: 25000
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

app.use(express.json());

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

// Start server
httpServer.listen(PORT, () => {
  console.log('🚀 DS Agent Server Started');
  console.log(`📡 HTTP Server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, io };
