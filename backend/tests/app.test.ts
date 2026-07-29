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

  it('does not attempt a second response when the error occurs after headers are already sent', async () => {
    // Reproduces the bug this test guards against: a route that has already
    // sent its response (e.g. a fire-and-forget block that throws after
    // `res.json()`) and then produces a rejected promise that
    // express-async-errors forwards to this middleware. Before the
    // `res.headersSent` guard, errorHandler would call `res.status()` /
    // `res.json()` a second time, which throws ERR_HTTP_HEADERS_SENT from
    // inside the error-handling middleware itself. With the guard, it
    // delegates to Express's built-in default error handler via next(err)
    // instead, so the request still completes cleanly with the original
    // response and no second write is attempted.
    const testApp = express();
    testApp.get('/post-response-boom', async (_req, res) => {
      res.json({ ok: true });
      throw new Error('post-response boom - must not crash the error handler');
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/post-response-boom');

    // The original response (sent before the throw) is what the client
    // actually receives; errorHandler must not have overwritten it or thrown
    // while trying to.
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
