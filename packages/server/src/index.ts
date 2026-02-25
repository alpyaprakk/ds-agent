import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
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
    origin: '*', // Allow all origins (including Figma plugin with origin: 'null')
    methods: ['GET', 'POST'],
    credentials: false // Must be false when origin is '*'
  },
  allowEIO3: true, // Allow Engine.IO v3 clients
  transports: ['polling', 'websocket']
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: '*', // Allow all origins (including Figma plugin)
  credentials: false
}));
app.use(express.json());

// Explicit CORS for all requests (including Socket.IO)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
  return;
});

// API routes (includes /api/health)
app.use('/api', apiRoutes);

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
