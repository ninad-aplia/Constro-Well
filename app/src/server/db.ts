// PrismaClient singleton (PROJECT_CONTEXT §6: `src/server/**` holds the
// server-side database access). Imported by API handlers / facades only —
// no React component ever imports this file. Prisma reads DATABASE_URL from
// `app/.env` (owner-created, gitignored); it is never hardcoded here.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

export const db = globalForPrisma.prismaClient ?? new PrismaClient();

// Next.js production server chunks can duplicate this module; cache on
// globalThis in every environment so all chunks share one connection pool.
globalForPrisma.prismaClient = db;
