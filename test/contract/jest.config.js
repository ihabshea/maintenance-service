/**
 * Contract Tests - Jest Configuration
 *
 * Contract tests verify that the API implementation matches the source of truth
 * documentation in ~/etit/docs/02-architecture/.
 *
 * Running Contract Tests:
 *   yarn test:contract                     # Run all contract tests
 *   yarn test:contract -- --testPathPattern="create-task"  # Run specific spec
 *
 * Generating Reports:
 *   yarn test:contract --json --outputFile=./test/contract/results.json
 *   npx ts-node test/contract/reports/generator.ts
 *
 * Reports are generated to ~/evas/tests/:
 *   - summary.md        : Pass/fail totals and top findings
 *   - coverage-matrix.md: Endpoint x scenario coverage table
 *   - findings.md       : Detailed mismatches and issues
 *
 * Why Tests Run Sequentially:
 *   Tests share a single database and must run sequentially (maxWorkers: 1)
 *   to avoid race conditions and ensure proper cleanup between tests.
 *
 * Test Categories:
 *   - Happy Path      : Valid inputs produce expected results
 *   - Validation      : Invalid inputs return 400 Bad Request
 *   - Tenancy         : Cross-tenant data isolation
 *   - Audit           : Audit log entries are created
 *   - Immutability    : Finalized records cannot be modified
 */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: 'specs/.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/setup.ts'],
  globalTeardown: '<rootDir>/teardown.ts',
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
};
