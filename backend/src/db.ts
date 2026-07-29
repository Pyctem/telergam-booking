import pg from 'pg';
import { config } from './config.js';

// BIGSERIAL/BIGINT columns (services.id, bookings.id, users.id, and FK columns
// referencing them) are Postgres OID 20 (int8). node-postgres returns these as
// strings by default since a JS number can't safely represent the full int8
// range. This app's ids come from ordinary BIGSERIAL sequences and will never
// approach Number.MAX_SAFE_INTEGER, so parsing them as numbers is safe and
// matches what backend/src/types.ts and frontend/src/types.ts already declare.
pg.types.setTypeParser(20, (value) => parseInt(value, 10));

export const pool = new pg.Pool({ connectionString: config.databaseUrl });
