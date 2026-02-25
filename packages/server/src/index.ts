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
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: (_origin, callback) => {
      // Allow all origins
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: false,
    allowedHeaders: ['Content-Type']
  },
  allowEIO3: true, // Allow Engine.IO v3 clients
  transports: ['polling', 'websocket']
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

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use(express.json());

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
