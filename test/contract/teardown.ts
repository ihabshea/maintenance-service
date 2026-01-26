import { PrismaClient } from '@prisma/client';
import { cleanupAllTestData } from './fixtures/seed';

/**
 * Global teardown for contract tests.
 * Ensures all test data is cleaned up after the test suite completes.
 */
export default async function globalTeardown(): Promise<void> {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL_TEST || process.env.DATABASE_URL,
      },
    },
  });

  try {
    await prisma.$connect();
    await cleanupAllTestData(prisma);
  } catch (error) {
    console.error('Error during global teardown:', error);
  } finally {
    await prisma.$disconnect();
  }
}
