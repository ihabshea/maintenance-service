import { PrismaClient } from '@prisma/client';
import {
  seedSystemData,
  seedTenantData,
  cleanupAllTestData,
} from './fixtures/seed';
import { UUIDS } from './fixtures/uuids';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
    },
  },
});

// Store prisma instance globally for tests
declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_TEST__: PrismaClient;
}

beforeAll(async () => {
  // Connect to database
  await prisma.$connect();
  global.__PRISMA_TEST__ = prisma;

  // Clean up any existing test data
  await cleanupAllTestData(prisma);

  // Seed system reference data
  await seedSystemData(prisma);

  // Seed tenant-specific reference data for both test tenants
  await seedTenantData(prisma, UUIDS.tenants.A);
  await seedTenantData(prisma, UUIDS.tenants.B);
});

afterAll(async () => {
  // Clean up test data
  await cleanupAllTestData(prisma);

  // Disconnect
  await prisma.$disconnect();
});

// Increase Jest timeout for database operations
jest.setTimeout(30000);
