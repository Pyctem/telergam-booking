import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createApp, errorHandler } from '../src/app.js';

describe('GET /health', () => {
  it('returns ok: true', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('async error handling safety net', () => {
  it('converts a thrown error in an async handler into a clean 500 instead of crashing', async () => {
    // Build a minimal app wired the same way createApp() wires the real one:
    // an async route that throws, registered *before* the exported
    // `errorHandler` (Express only routes errors to error-handling middleware
    // registered after the throwing layer in the stack). Importing
    // '../src/app.js' above pulls in app.ts's top-level
    // `import 'express-async-errors'`, which monkey-patches Express's router
    // layer globally for the whole process — so this app benefits from the
    // same patch the real app does, without needing to re-import it here.
    //
    // Without the fix (no express-async-errors import, no errorHandler
    // registered), the rejected promise from this handler would be an
    // unhandled rejection: supertest would either hang/timeout waiting for a
    // response, or in this Node version the process would crash outright —
    // not a clean 500. With the fix, express-async-errors forwards the
    // rejection to `next(err)`, which reaches `errorHandler` and produces a
    // well-formed, non-leaking 500.
    const testApp = express();
    testApp.get('/throws', async () => {
      throw new Error('boom - this message must never leak to the client');
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/throws');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain('boom');
  });
});
