import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create system workshops
  const workshops = await Promise.all([
    prisma.workshop.upsert({
      where: { id: '00000000-0000-0000-0000-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000001',
        scope: 'system',
        tenantId: null,
        name: 'Main Service Center',
        location: 'Cairo, Egypt',
        status: 'active',
      },
    }),
    prisma.workshop.upsert({
      where: { id: '00000000-0000-0000-0000-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000002',
        scope: 'system',
        tenantId: null,
        name: 'Quick Service Workshop',
        location: 'Alexandria, Egypt',
        status: 'active',
      },
    }),
    prisma.workshop.upsert({
      where: { id: '00000000-0000-0000-0000-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000003',
        scope: 'system',
        tenantId: null,
        name: 'Authorized Dealer Service',
        location: 'Giza, Egypt',
        status: 'active',
      },
    }),
  ]);

  console.log(`Created ${workshops.length} system workshops`);

  // Create system cancellation reasons
  const reasons = await Promise.all([
    prisma.reason.upsert({
      where: { id: '00000000-0000-0000-0000-000000000101' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000101',
        scope: 'system',
        tenantId: null,
        reasonType: 'cancellation',
        label: 'Vehicle sold',
        status: 'active',
      },
    }),
    prisma.reason.upsert({
      where: { id: '00000000-0000-0000-0000-000000000102' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000102',
        scope: 'system',
        tenantId: null,
        reasonType: 'cancellation',
        label: 'Vehicle decommissioned',
        status: 'active',
      },
    }),
    prisma.reason.upsert({
      where: { id: '00000000-0000-0000-0000-000000000103' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000103',
        scope: 'system',
        tenantId: null,
        reasonType: 'cancellation',
        label: 'Duplicate task',
        status: 'active',
      },
    }),
    prisma.reason.upsert({
      where: { id: '00000000-0000-0000-0000-000000000104' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000104',
        scope: 'system',
        tenantId: null,
        reasonType: 'cancellation',
        label: 'Maintenance no longer needed',
        status: 'active',
      },
    }),
    prisma.reason.upsert({
      where: { id: '00000000-0000-0000-0000-000000000105' },
      update: {},
      create: {
        id: '00000000-0000-0000-0000-000000000105',
        scope: 'system',
        tenantId: null,
        reasonType: 'cancellation',
        label: 'Other',
        status: 'active',
      },
    }),
  ]);

  console.log(`Created ${reasons.length} system cancellation reasons`);

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
