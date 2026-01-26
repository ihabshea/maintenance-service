import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';

let app: INestApplication | null = null;
let moduleFixture: TestingModule | null = null;

/**
 * Creates and initializes the NestJS application for testing.
 * Reuses the same app instance across tests for performance.
 */
export async function createTestApp(): Promise<INestApplication> {
  if (app) {
    return app;
  }

  moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();

  // Set global prefix to match production configuration
  app.setGlobalPrefix('api');

  // Configure validation pipe to match production settings
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.init();

  return app;
}

/**
 * Returns the existing app instance or creates a new one.
 */
export async function getTestApp(): Promise<INestApplication> {
  if (!app) {
    return createTestApp();
  }
  return app;
}

/**
 * Closes the test application.
 * Should be called in afterAll hook.
 */
export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = null;
    moduleFixture = null;
  }
}

/**
 * Returns the testing module for direct service access.
 */
export function getTestModule(): TestingModule | null {
  return moduleFixture;
}
