# Testing Strategy - DS Agent (Tokenhaus MCP)

**Date:** 2026-03-02
**Version:** 1.0.0
**Status:** Testing infrastructure documented, implementation in progress

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Coverage Goals](#test-coverage-goals)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [End-to-End Tests](#end-to-end-tests)
6. [Performance Tests](#performance-tests)
7. [Security Tests](#security-tests)
8. [Test Infrastructure](#test-infrastructure)
9. [Running Tests](#running-tests)
10. [CI/CD Integration](#cicd-integration)

---

## Testing Philosophy

**Priorities:**
1. **Security**: Auth, authorization, input validation
2. **Reliability**: Critical user workflows must never fail
3. **Performance**: Design system syncs with 1000+ tokens must complete <5s
4. **User Experience**: WebSocket real-time updates must be instant

**Testing Pyramid:**
- **70% Unit Tests**: Fast, isolated, comprehensive coverage
- **20% Integration Tests**: API routes, database interactions, WebSocket handlers
- **10% E2E Tests**: Critical user journeys (auth → sync → create component)

---

## Test Coverage Goals

### Minimum Coverage Targets
- **Overall**: 80% code coverage
- **Critical paths**: 100% coverage
  - Authentication & authorization
  - Token CRUD operations
  - Component creation
  - Design system sync
  - WebSocket communication

### Critical Paths Defined
1. User registration → login → workspace creation
2. Plugin connection → design system sync → database storage
3. MCP tool call → WebSocket command → plugin execution → result retrieval
4. Token creation → Figma variable creation → screenshot validation
5. Component creation → variant generation → token binding

---

## Unit Tests

### 1. Authentication Tests (`packages/server/src/__tests__/auth.test.ts`)

```typescript
import { generateToken, verifyToken, authMiddleware } from '../middleware/auth';
import { Request, Response } from 'express';

describe('Authentication', () => {
  describe('generateToken', () => {
    it('should generate valid JWT with user data', () => {
      const user = { id: '123', email: 'test@example.com', name: 'Test User' };
      const token = generateToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = verifyToken(token);
      expect(decoded.id).toBe(user.id);
      expect(decoded.email).toBe(user.email);
      expect(decoded.name).toBe(user.name);
    });

    it('should throw error if JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET;

      expect(() => {
        require('../middleware/auth');
      }).toThrow('JWT_SECRET environment variable is required');
    });

    it('should set expiration to 7 days', () => {
      const user = { id: '123', email: 'test@example.com', name: 'Test User' };
      const token = generateToken(user);
      const decoded: any = jwt.decode(token);

      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(7 * 24 * 60 * 60); // 7 days in seconds
    });
  });

  describe('verifyToken', () => {
    it('should verify valid tokens', () => {
      const user = { id: '123', email: 'test@example.com', name: 'Test User' };
      const token = generateToken(user);

      const verified = verifyToken(token);
      expect(verified).toEqual(user);
    });

    it('should reject expired tokens', async () => {
      // Create token with 1 second expiry
      const token = jwt.sign({ id: '123' }, process.env.JWT_SECRET!, { expiresIn: '1s' });

      // Wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));

      expect(() => verifyToken(token)).toThrow();
    });

    it('should reject tampered tokens', () => {
      const token = generateToken({ id: '123', email: 'test@example.com', name: 'Test' });
      const tampered = token.slice(0, -5) + 'XXXXX';

      expect(() => verifyToken(tampered)).toThrow();
    });
  });

  describe('authMiddleware', () => {
    it('should allow requests with valid Bearer token', () => {
      const user = { id: '123', email: 'test@example.com', name: 'Test User' };
      const token = generateToken(user);

      const req = {
        headers: { authorization: `Bearer ${token}` }
      } as Request;
      const res = {} as Response;
      const next = jest.fn();

      authMiddleware(req as any, res, next);

      expect((req as any).user).toEqual(user);
      expect(next).toHaveBeenCalled();
    });

    it('should reject requests without Authorization header', () => {
      const req = { headers: {} } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      authMiddleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reject requests with invalid token', () => {
      const req = {
        headers: { authorization: 'Bearer invalid_token' }
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any;
      const next = jest.fn();

      authMiddleware(req as any, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
```

### 2. Rate Limiting Tests (`packages/server/src/__tests__/rate-limiting.test.ts`)

```typescript
import request from 'supertest';
import { app } from '../index';

describe('Rate Limiting', () => {
  describe('POST /api/auth/login', () => {
    it('should allow 5 requests within 15 minutes', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };

      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .send(credentials);

        expect(res.status).not.toBe(429); // Not rate limited
      }
    });

    it('should block 6th request within 15 minutes', async () => {
      const credentials = { email: 'test@example.com', password: 'password123' };

      // Make 6 requests
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(credentials);
      }

      // 6th request should be rate limited
      const res = await request(app)
        .post('/api/auth/login')
        .send(credentials);

      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({
        message: 'Too many authentication attempts, please try again later'
      });
    });
  });

  describe('POST /api/auth/plugin-session/start', () => {
    it('should allow 30 requests per minute', async () => {
      for (let i = 0; i < 30; i++) {
        const res = await request(app)
          .post('/api/auth/plugin-session/start')
          .send({ sessionId: `session-${i}` });

        expect(res.status).not.toBe(429);
      }
    });

    it('should block 31st request within 1 minute', async () => {
      for (let i = 0; i < 31; i++) {
        await request(app)
          .post('/api/auth/plugin-session/start')
          .send({ sessionId: `session-${i}` });
      }

      const res = await request(app)
        .post('/api/auth/plugin-session/start')
        .send({ sessionId: 'session-31' });

      expect(res.status).toBe(429);
    });
  });
});
```

### 3. Input Validation Tests (`packages/mcp/src/__tests__/validation.test.ts`)

```typescript
import { SetTokensInputSchema, CreateComponentInputSchema } from '../types';

describe('Input Validation (Zod Schemas)', () => {
  describe('SetTokensInputSchema', () => {
    it('should accept valid token input', () => {
      const valid = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        tokens: [
          { variableName: 'color/brand/primary', value: '#2563EB', type: 'COLOR' },
          { variableName: 'spacing/4', value: 16, type: 'FLOAT' }
        ]
      };

      expect(() => SetTokensInputSchema.parse(valid)).not.toThrow();
    });

    it('should reject missing workspaceId', () => {
      const invalid = {
        tokens: [{ variableName: 'color/brand/primary', value: '#2563EB' }]
      };

      expect(() => SetTokensInputSchema.parse(invalid)).toThrow();
    });

    it('should reject invalid hex color', () => {
      const invalid = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        tokens: [{ variableName: 'color/brand/primary', value: 'not-a-color', type: 'COLOR' }]
      };

      expect(() => SetTokensInputSchema.parse(invalid)).toThrow();
    });

    it('should reject negative FLOAT values for spacing', () => {
      const invalid = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        tokens: [{ variableName: 'spacing/4', value: -16, type: 'FLOAT' }]
      };

      expect(() => SetTokensInputSchema.parse(invalid)).toThrow();
    });
  });

  describe('CreateComponentInputSchema', () => {
    it('should require layers parameter', () => {
      const invalid = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        pageName: 'Components',
        componentName: 'Button',
        // Missing layers!
      };

      expect(() => CreateComponentInputSchema.parse(invalid)).toThrow('layers');
    });

    it('should validate layer structure', () => {
      const valid = {
        workspaceId: '550e8400-e29b-41d4-a716-446655440000',
        pageName: 'Components',
        componentName: 'Button',
        layers: [
          {
            type: 'frame',
            name: 'Button',
            layout: 'horizontal',
            fill: 'color/brand/primary',
            children: [
              { type: 'text', name: 'Label', text: 'Button' }
            ]
          }
        ]
      };

      expect(() => CreateComponentInputSchema.parse(valid)).not.toThrow();
    });
  });
});
```

---

## Integration Tests

### 1. API Routes Tests (`packages/server/src/__tests__/integration/workspaces.test.ts`)

```typescript
import request from 'supertest';
import { app } from '../../index';
import { generateToken } from '../../middleware/auth';
import pool from '../../db/connection';

describe('Workspace API Integration', () => {
  let authToken: string;
  let userId: string;
  let workspaceId: string;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
      ['test@example.com', 'hashed_password', 'Test User']
    );
    userId = userResult.rows[0].id;

    authToken = generateToken({
      id: userId,
      email: 'test@example.com',
      name: 'Test User'
    });
  });

  afterAll(async () => {
    // Cleanup
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  describe('POST /api/workspaces', () => {
    it('should create a new workspace', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Test Workspace' });

      expect(res.status).toBe(201);
      expect(res.body.workspace).toMatchObject({
        name: 'Test Workspace',
        health_score: 0,
        total_variables: 0,
        total_components: 0
      });

      workspaceId = res.body.workspace.id;
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post('/api/workspaces')
        .send({ name: 'Test Workspace' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/workspaces/:id', () => {
    it('should return workspace details', async () => {
      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.workspace.id).toBe(workspaceId);
      expect(res.body.workspace.name).toBe('Test Workspace');
    });

    it('should enforce workspace membership', async () => {
      // Create another user
      const otherUser = await pool.query(
        'INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3) RETURNING id',
        ['other@example.com', 'hashed_password', 'Other User']
      );
      const otherToken = generateToken({
        id: otherUser.rows[0].id,
        email: 'other@example.com',
        name: 'Other User'
      });

      const res = await request(app)
        .get(`/api/workspaces/${workspaceId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Access denied');

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.rows[0].id]);
    });
  });
});
```

### 2. WebSocket Communication Tests (`packages/server/src/__tests__/integration/websocket.test.ts`)

```typescript
import { io as ioClient, Socket } from 'socket.io-client';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'http';
import { setupWebSocketHandlers } from '../../websocket/handlers';
import { generateToken } from '../../middleware/auth';

describe('WebSocket Integration', () => {
  let io: SocketIOServer;
  let serverSocket: Socket;
  let clientSocket: Socket;
  let httpServer: any;

  beforeAll((done) => {
    httpServer = createServer();
    io = new SocketIOServer(httpServer);
    setupWebSocketHandlers(io);

    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = ioClient(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  describe('Authentication', () => {
    it('should allow connections with valid token', (done) => {
      const token = generateToken({ id: '123', email: 'test@example.com', name: 'Test' });

      const authClient = ioClient(`http://localhost:${(httpServer.address() as any).port}`, {
        auth: { token }
      });

      authClient.on('connect', () => {
        expect(authClient.connected).toBe(true);
        authClient.close();
        done();
      });

      authClient.on('connect_error', (err) => {
        fail(`Should not error: ${err.message}`);
      });
    });

    it('should reject connections without token', (done) => {
      const noAuthClient = ioClient(`http://localhost:${(httpServer.address() as any).port}`);

      noAuthClient.on('connect_error', (err) => {
        expect(err.message).toContain('Authentication required');
        noAuthClient.close();
        done();
      });

      noAuthClient.on('connect', () => {
        fail('Should not connect without auth');
      });
    });
  });

  describe('Plugin Connection', () => {
    it('should broadcast plugin status on connection', (done) => {
      clientSocket.on('plugin-status', (data) => {
        expect(data).toMatchObject({
          connected: true,
          plugin: 'figma-plugin'
        });
        done();
      });

      clientSocket.emit('plugin-connect', {
        plugin: 'figma-plugin',
        timestamp: new Date().toISOString()
      });
    });

    it('should handle heartbeat updates', (done) => {
      clientSocket.emit('plugin-connect', {
        plugin: 'figma-plugin',
        timestamp: new Date().toISOString()
      });

      setTimeout(() => {
        clientSocket.emit('heartbeat');
        // If no error, heartbeat was accepted
        setTimeout(done, 100);
      }, 100);
    });
  });

  describe('Design System Sync', () => {
    it('should process valid sync data', (done) => {
      const syncData = {
        file: { key: 'test-file-key', name: 'Test Design System' },
        variables: [
          { id: 'var-1', name: 'color/brand/primary', key: 'key-1', resolvedType: 'COLOR', valuesByMode: { 'mode-1': { r: 0.15, g: 0.4, b: 0.9, a: 1 } }, variableCollectionId: 'col-1' }
        ],
        collections: [
          { id: 'col-1', name: 'Primitives', key: 'col-key-1', modes: [{ modeId: 'mode-1', name: 'Default' }], variableIds: ['var-1'] }
        ],
        components: [
          { key: 'comp-1', name: 'Button', description: 'Primary button', parent: { id: 'page-1', name: 'Components' } }
        ]
      };

      clientSocket.on('sync-complete', (data) => {
        expect(data.success).toBe(true);
        expect(data.stats.variables).toBe(1);
        expect(data.stats.components).toBe(1);
        done();
      });

      clientSocket.emit('design-system-sync', syncData);
    });

    it('should reject invalid sync data', (done) => {
      const invalidData = {
        file: { key: 'test-file-key', name: 'Test' },
        // Missing variables, collections, components
      };

      clientSocket.on('sync-error', (data) => {
        expect(data.error).toContain('Invalid sync data format');
        done();
      });

      clientSocket.emit('design-system-sync', invalidData);
    });
  });
});
```

---

## End-to-End Tests

### Critical User Journey: Auth → Sync → Create Component

```typescript
// packages/server/src/__tests__/e2e/complete-workflow.test.ts

import request from 'supertest';
import { io as ioClient } from 'socket.io-client';
import { app } from '../../index';

describe('E2E: Complete Design System Workflow', () => {
  let authToken: string;
  let userId: string;
  let workspaceId: string;
  let clientSocket: any;

  it('should complete full workflow: register → login → create workspace → sync → create component', async () => {
    // Step 1: Register user
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'e2e@example.com',
        password: 'SecurePass123',
        name: 'E2E Test User'
      });

    expect(registerRes.status).toBe(201);
    authToken = registerRes.body.token;
    userId = registerRes.body.user.id;

    // Step 2: Create workspace
    const workspaceRes = await request(app)
      .post('/api/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'E2E Test Workspace' });

    expect(workspaceRes.status).toBe(201);
    workspaceId = workspaceRes.body.workspace.id;

    // Step 3: Connect via WebSocket
    clientSocket = ioClient(`http://localhost:3000`, {
      auth: { token: authToken }
    });

    await new Promise((resolve) => {
      clientSocket.on('connect', resolve);
    });

    // Step 4: Sync design system
    const syncComplete = new Promise((resolve) => {
      clientSocket.on('sync-complete', resolve);
    });

    clientSocket.emit('design-system-sync', {
      workspaceId,
      file: { key: 'e2e-test-file', name: 'E2E Test File' },
      variables: [
        { id: 'var-1', name: 'color/brand/primary', key: 'key-1', resolvedType: 'COLOR', valuesByMode: { 'mode-1': { r: 0.15, g: 0.4, b: 0.9, a: 1 } }, variableCollectionId: 'col-1' }
      ],
      collections: [
        { id: 'col-1', name: 'Primitives', key: 'col-key-1', modes: [{ modeId: 'mode-1', name: 'Default' }], variableIds: ['var-1'] }
      ],
      components: []
    });

    const syncResult: any = await syncComplete;
    expect(syncResult.success).toBe(true);

    // Step 5: Verify workspace updated
    const wsRes = await request(app)
      .get(`/api/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(wsRes.body.workspace.total_variables).toBe(1);

    // Cleanup
    clientSocket.close();
    await request(app)
      .delete(`/api/workspaces/${workspaceId}`)
      .set('Authorization', `Bearer ${authToken}`);
  }, 30000); // 30 second timeout for full E2E
});
```

---

## Performance Tests

### Load Testing with Artillery

```yaml
# packages/server/artillery.yml

config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10  # 10 requests per second
      name: "Warm up"
    - duration: 120
      arrivalRate: 50  # 50 requests per second
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100 # 100 requests per second
      name: "Spike test"

scenarios:
  - name: "Design System Sync Performance"
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "loadtest@example.com"
            password: "LoadTest123"
          capture:
            - json: "$.token"
              as: "authToken"

      - post:
          url: "/api/workspaces"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            name: "Load Test Workspace"
          capture:
            - json: "$.workspace.id"
              as: "workspaceId"

      - think: 1

      - get:
          url: "/api/workspaces/{{ workspaceId }}/design-system"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
            - contentType: "application/json"
```

**Run:** `artillery run packages/server/artillery.yml`

**Performance Targets:**
- P50 latency: <100ms for API requests
- P95 latency: <500ms for API requests
- P99 latency: <1000ms for API requests
- Throughput: 100 req/s sustained
- WebSocket sync (1000 tokens): <5 seconds

---

## Security Tests

### Penetration Testing Checklist

```typescript
// packages/server/src/__tests__/security/vulnerabilities.test.ts

describe('Security Vulnerability Tests', () => {
  describe('SQL Injection', () => {
    it('should reject SQL injection in workspace search', async () => {
      const malicious = "'; DROP TABLE workspaces; --";

      const res = await request(app)
        .get(`/api/workspaces?search=${encodeURIComponent(malicious)}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).not.toBe(500);
      // Verify workspaces table still exists
      const check = await pool.query('SELECT 1 FROM workspaces LIMIT 1');
      expect(check.rows.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize malicious component names', async () => {
      const xssAttempt = '<script>alert("XSS")</script>';

      const res = await request(app)
        .post('/api/components')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          workspaceId: testWorkspaceId,
          name: xssAttempt,
          description: 'Test component'
        });

      // Verify name is stored safely (escaped or rejected)
      expect(res.body.component.name).not.toContain('<script>');
    });
  });

  describe('JWT Security', () => {
    it('should reject tokens with "none" algorithm', () => {
      const noneToken = jwt.sign({ id: '123' }, '', { algorithm: 'none' as any });

      const req = { headers: { authorization: `Bearer ${noneToken}` } } as Request;
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;

      authMiddleware(req as any, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  describe('Rate Limiting Bypass Attempts', () => {
    it('should not allow IP spoofing to bypass rate limits', async () => {
      // Attempt to bypass by changing X-Forwarded-For
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', `192.168.1.${i}`)
          .send({ email: 'test@example.com', password: 'test' });
      }

      // 11th request should still be rate limited
      const res = await request(app)
        .post('/api/auth/login')
        .set('X-Forwarded-For', '192.168.1.200')
        .send({ email: 'test@example.com', password: 'test' });

      expect(res.status).toBe(429);
    });
  });
});
```

---

## Test Infrastructure

### Setup & Configuration

#### 1. Install Test Dependencies

```bash
cd packages/server

npm install --save-dev \
  jest \
  @types/jest \
  ts-jest \
  supertest \
  @types/supertest \
  socket.io-client \
  artillery
```

#### 2. Jest Configuration (`packages/server/jest.config.js`)

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
```

#### 3. Test Setup File (`packages/server/src/__tests__/setup.ts`)

```typescript
import dotenv from 'dotenv';
import pool from '../db/connection';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set required env vars for tests
process.env.JWT_SECRET = 'test-secret-key-do-not-use-in-production';
process.env.NODE_ENV = 'test';

// Global setup
beforeAll(async () => {
  // Create test database schema if needed
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
});

// Global teardown
afterAll(async () => {
  await pool.end();
});

// Increase timeout for integration tests
jest.setTimeout(10000);
```

---

## Running Tests

### Local Development

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- auth.test.ts

# Run in watch mode
npm test -- --watch

# Run only unit tests
npm test -- --testPathPattern=__tests__/(?!integration|e2e)

# Run only integration tests
npm test -- --testPathPattern=integration

# Run only E2E tests
npm test -- --testPathPattern=e2e
```

### Performance Testing

```bash
# Install Artillery globally
npm install -g artillery

# Run load tests
artillery run packages/server/artillery.yml

# Run with report
artillery run --output report.json packages/server/artillery.yml
artillery report report.json
```

---

## CI/CD Integration

### GitHub Actions Workflow (`.github/workflows/test.yml`)

```yaml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: dsagent_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm test -- --testPathPattern=__tests__/(?!integration|e2e)
        env:
          JWT_SECRET: test-secret-for-ci
          DATABASE_URL: postgresql://test:test@localhost:5432/dsagent_test

      - name: Run integration tests
        run: npm test -- --testPathPattern=integration
        env:
          JWT_SECRET: test-secret-for-ci
          DATABASE_URL: postgresql://test:test@localhost:5432/dsagent_test

      - name: Run E2E tests
        run: npm test -- --testPathPattern=e2e
        env:
          JWT_SECRET: test-secret-for-ci
          DATABASE_URL: postgresql://test:test@localhost:5432/dsagent_test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

      - name: Run performance tests
        run: |
          npm start &
          sleep 5
          artillery run packages/server/artillery.yml
        env:
          JWT_SECRET: test-secret-for-ci
          DATABASE_URL: postgresql://test:test@localhost:5432/dsagent_test
```

---

## Summary

### Implementation Status
- ✅ **Testing strategy documented**
- ✅ **Test examples provided** for all critical paths
- ✅ **Performance testing strategy** with Artillery
- ✅ **Security testing checklist** created
- ⏳ **Full test implementation** - In progress

### Next Steps
1. Install test dependencies (`jest`, `supertest`, `socket.io-client`)
2. Create `jest.config.js` and test setup files
3. Implement unit tests for authentication, rate limiting, input validation
4. Implement integration tests for API routes and WebSocket handlers
5. Implement E2E tests for critical user journeys
6. Set up CI/CD pipeline with GitHub Actions
7. Establish code coverage reporting with Codecov

### Coverage Goals
- **Current**: 0% (no tests implemented yet)
- **Target**: 80% overall, 100% for critical paths
- **Timeline**: Complete implementation within 2 weeks

---

**Document Maintained By:** Claude Code
**Last Updated:** 2026-03-02
**Version:** 1.0.0
