import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './apps/identity/src/database/schema/index.ts',
  out: './apps/identity/src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/identity_db',
  },
});
