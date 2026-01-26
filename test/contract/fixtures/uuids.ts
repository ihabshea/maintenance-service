/**
 * Deterministic UUIDs for contract testing.
 * Using predictable UUIDs makes tests reproducible and debugging easier.
 */
export const UUIDS = {
  tenants: {
    A: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    B: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  },
  vehicles: {
    V1: '11111111-1111-4111-8111-111111111111',
    V2: '22222222-2222-4222-8222-222222222222',
    V3: '33333333-3333-4333-8333-333333333333',
    V4: '44444444-4444-4444-8444-444444444444',
    V5: '55555555-5555-4555-8555-555555555555',
  },
  workshops: {
    SYSTEM_MAIN: '00000000-0000-4000-8000-000000000001',
    SYSTEM_QUICK: '00000000-0000-4000-8000-000000000002',
    SYSTEM_DEALER: '00000000-0000-4000-8000-000000000003',
    TENANT_A: 'aaaa0001-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    TENANT_B: 'bbbb0001-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  },
  reasons: {
    SYSTEM_SOLD: '00000000-0000-4000-8000-000000000101',
    SYSTEM_DECOMMISSIONED: '00000000-0000-4000-8000-000000000102',
    TENANT_A: 'aaaa0101-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    TENANT_B: 'bbbb0101-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  },
  tasks: {
    TASK_1: '01010101-1111-4111-8111-111111111111',
    TASK_2: '02020202-2222-4222-8222-222222222222',
    TASK_3: '03030303-3333-4333-8333-333333333333',
  },
  nonExistent: {
    TASK: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    VEHICLE: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    WORKSHOP: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    REASON: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  },
};

export const INVALID_UUIDS = {
  NOT_UUID: 'not-a-uuid',
  EMPTY: '',
  PARTIAL: 'aaaaaaaa-aaaa-4aaa',
  WITH_SPACES: 'aaaaaaaa aaaa 4aaa 8aaa aaaaaaaaaaaa',
};
