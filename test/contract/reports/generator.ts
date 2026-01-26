import * as fs from 'fs';
import * as path from 'path';

/**
 * Report Generator for Contract Tests
 *
 * Parses Jest JSON output and generates comprehensive Markdown reports.
 */

interface JestTestResult {
  name: string;
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  duration?: number;
  failureMessages?: string[];
}

interface JestTestSuite {
  name: string;
  tests: JestTestResult[];
}

interface JestResult {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  startTime: number;
  testResults: Array<{
    name: string;
    status: string;
    message: string;
    assertionResults: JestTestResult[];
  }>;
}

interface EndpointCoverage {
  endpoint: string;
  method: string;
  scenarios: {
    happy: boolean;
    validation: boolean;
    tenancy: boolean;
    audit: boolean;
    immutability: boolean;
  };
  tests: string[];
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  endpoint: string;
  description: string;
  expected: string;
  actual: string;
  reproduction: string;
}

// Output directory for reports
const OUTPUT_DIR = path.join(process.env.HOME || '~', 'evas', 'tests');
const INPUT_FILE = path.join(__dirname, '..', 'results.json');

function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseJestResults(): JestResult | null {
  try {
    const content = fs.readFileSync(INPUT_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Failed to parse Jest results:', error);
    return null;
  }
}

function extractEndpointFromTestName(testName: string): string {
  const patterns = [
    { regex: /POST \/api\/maintenance\/tasks$/, endpoint: 'POST /api/maintenance/tasks' },
    { regex: /GET \/api\/maintenance\/tasks\/:taskId$/, endpoint: 'GET /api/maintenance/tasks/:taskId' },
    { regex: /POST .*\/vehicles$/, endpoint: 'POST /api/maintenance/tasks/:taskId/vehicles' },
    { regex: /GET \/api\/vehicles\/:vehicleId\/maintenance/, endpoint: 'GET /api/vehicles/:vehicleId/maintenance' },
    { regex: /status\/completed/, endpoint: 'PATCH .../status/completed' },
    { regex: /status\/cancelled/, endpoint: 'PATCH .../status/cancelled' },
    { regex: /status\/rescheduled/, endpoint: 'PATCH .../status/rescheduled' },
    { regex: /corrections/, endpoint: 'POST .../corrections' },
    { regex: /attachments/, endpoint: 'Attachments' },
    { regex: /workshops/, endpoint: 'Workshops' },
    { regex: /reasons/, endpoint: 'Reasons' },
    { regex: /X-Tenant-Id/, endpoint: 'Header Validation' },
    { regex: /Swagger/, endpoint: 'Swagger' },
    { regex: /Cross-Tenant/, endpoint: 'Cross-Tenant' },
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(testName)) {
      return pattern.endpoint;
    }
  }

  return 'Other';
}

function categorizeTest(testName: string | undefined): string {
  if (!testName) return 'other';
  const lowerName = testName.toLowerCase();

  // Check specific categories FIRST (before defaulting to happy path)
  if (lowerName.includes('validation') || lowerName.includes('reject') ||
      lowerName.includes('invalid') || lowerName.includes('missing')) {
    return 'validation';
  }
  if (lowerName.includes('tenant') || lowerName.includes('isolation')) {
    return 'tenancy';
  }
  if (lowerName.includes('audit')) {
    return 'audit';
  }
  if (lowerName.includes('immutab') || lowerName.includes('already')) {
    return 'immutability';
  }
  // Default to happy path for positive test cases
  return 'happy';
}

function generateReadme(): string {
  const timestamp = new Date().toISOString();
  return `# Contract Test Reports

Generated: ${timestamp}

## Overview

This directory contains the contract test results for the Vehicle Maintenance Service API.

## Prerequisites

- Node.js 18+
- PostgreSQL running on port 5434
- Redis running on port 6381 (optional)

## Environment Variables

\`\`\`bash
export DATABASE_URL_TEST="postgresql://postgres:postgres@localhost:5434/maintenance_test"
\`\`\`

## Running Tests

\`\`\`bash
# Run all contract tests
cd ~/maintenance-service
yarn test:contract

# Generate reports
yarn test:contract:report
\`\`\`

## Report Files

| File | Description |
|------|-------------|
| summary.md | Pass/fail totals and top findings |
| coverage-matrix.md | Endpoint x scenario coverage table |
| findings.md | Detailed mismatches and issues |
| raw-results.md | Full Jest output and timestamps |
| per-endpoint/*.md | Individual endpoint details |

## Source of Truth Documents

- \`~/etit/docs/02-architecture/api-contract.md\` -- API endpoints
- \`~/etit/docs/02-architecture/data-model.md\` -- Schema definitions
- \`~/etit/docs/02-architecture/validation-rules.md\` -- Input validation
- \`~/etit/docs/02-architecture/audit-and-immutability.md\` -- Audit logging
- \`~/etit/docs/02-architecture/tenancy-model.md\` -- Multi-tenant rules
`;
}

function generateSummary(results: JestResult): string {
  const passRate = ((results.numPassedTests / results.numTotalTests) * 100).toFixed(1);
  const duration = results.testResults.reduce((sum, suite) => {
    return sum + suite.assertionResults.reduce((s, t) => s + (t.duration || 0), 0);
  }, 0);

  const failedTests = results.testResults.flatMap(suite =>
    suite.assertionResults.filter(t => t.status === 'failed')
  );

  let findingsSection = '';
  if (failedTests.length > 0) {
    findingsSection = `
## Top Findings

| Severity | Test | Issue |
|----------|------|-------|
${failedTests.slice(0, 10).map(t =>
  `| High | ${t.name} | ${(t.failureMessages?.[0] || 'Unknown').substring(0, 80)}... |`
).join('\n')}
`;
  }

  return `# Contract Test Summary

Generated: ${new Date().toISOString()}

## Results Overview

| Metric | Value |
|--------|-------|
| Total Tests | ${results.numTotalTests} |
| Passed | ${results.numPassedTests} |
| Failed | ${results.numFailedTests} |
| Pending | ${results.numPendingTests} |
| Pass Rate | ${passRate}% |
| Duration | ${(duration / 1000).toFixed(2)}s |

## Status

${results.numFailedTests === 0 ? '**All contract tests passed.**' : `**${results.numFailedTests} tests failed.** See findings.md for details.`}

## Severity Breakdown

| Severity | Count |
|----------|-------|
| Critical | ${failedTests.filter(t => t.name.includes('tenant') || t.name.includes('security')).length} |
| High | ${failedTests.filter(t => t.name.includes('validation') || t.name.includes('immutab')).length} |
| Medium | ${failedTests.filter(t => t.name.includes('audit')).length} |
| Low | ${failedTests.length - failedTests.filter(t => t.name.includes('tenant') || t.name.includes('security') || t.name.includes('validation') || t.name.includes('immutab') || t.name.includes('audit')).length} |
${findingsSection}
`;
}

function generateCoverageMatrix(results: JestResult): string {
  const endpoints: Record<string, EndpointCoverage> = {};

  for (const suite of results.testResults) {
    for (const test of suite.assertionResults) {
      const endpoint = extractEndpointFromTestName(suite.name);
      const category = categorizeTest(test.name);

      if (!endpoints[endpoint]) {
        endpoints[endpoint] = {
          endpoint,
          method: endpoint.split(' ')[0] || 'N/A',
          scenarios: {
            happy: false,
            validation: false,
            tenancy: false,
            audit: false,
            immutability: false,
          },
          tests: [],
        };
      }

      if (category in endpoints[endpoint].scenarios) {
        (endpoints[endpoint].scenarios as any)[category] = true;
      }
      endpoints[endpoint].tests.push(test.name);
    }
  }

  const check = (val: boolean) => val ? 'Y' : '-';

  return `# Coverage Matrix

Generated: ${new Date().toISOString()}

## Endpoint Coverage

| Endpoint | Happy | Validation | Tenancy | Audit | Immutability |
|----------|-------|------------|---------|-------|--------------|
${Object.values(endpoints).map(e =>
  `| ${e.endpoint} | ${check(e.scenarios.happy)} | ${check(e.scenarios.validation)} | ${check(e.scenarios.tenancy)} | ${check(e.scenarios.audit)} | ${check(e.scenarios.immutability)} |`
).join('\n')}

## Legend

- **Y** -- Covered by at least one test
- **-** -- Not covered

## Test Count by Endpoint

| Endpoint | Test Count |
|----------|------------|
${Object.values(endpoints).map(e =>
  `| ${e.endpoint} | ${e.tests.length} |`
).join('\n')}
`;
}

function generateFindings(results: JestResult): string {
  const failedTests = results.testResults.flatMap(suite =>
    suite.assertionResults
      .filter(t => t.status === 'failed')
      .map(t => ({ suite: suite.name, ...t }))
  );

  if (failedTests.length === 0) {
    return `# Findings Report

Generated: ${new Date().toISOString()}

## Summary

**No mismatches found.** All contract tests passed successfully.

The API implementation matches the source of truth documentation.
`;
  }

  return `# Findings Report

Generated: ${new Date().toISOString()}

## Summary

**${failedTests.length} mismatches found** between API implementation and documentation.

## Detailed Findings

${failedTests.map((test, index) => `
### Finding #${index + 1}

**Test:** ${test.name}

**Suite:** ${test.suite}

**Severity:** ${test.name.includes('tenant') ? 'Critical' : test.name.includes('validation') ? 'High' : 'Medium'}

**Issue:**
\`\`\`
${(test.failureMessages?.[0] || 'No error message').substring(0, 500)}
\`\`\`

**Source of Truth Reference:** See api-contract.md

**Proposed Fix:** Review implementation against documented behavior.

---
`).join('\n')}
`;
}

function generateRawResults(results: JestResult): string {
  const timestamp = new Date().toISOString();

  return `# Raw Test Results

Generated: ${timestamp}

## Command

\`\`\`bash
yarn test:contract --json --outputFile=./test/contract/results.json
\`\`\`

## Environment

| Variable | Value |
|----------|-------|
| NODE_ENV | test |
| DATABASE_URL_TEST | postgresql://postgres:postgres@localhost:5434/maintenance_test |

## Timestamps

| Event | Time |
|-------|------|
| Start | ${new Date(results.startTime).toISOString()} |
| End | ${timestamp} |

## Jest Output

### Test Suites

${results.testResults.map(suite => `
#### ${path.basename(suite.name)}

Status: ${suite.status}

| Test | Status | Duration |
|------|--------|----------|
${suite.assertionResults.map(t => {
  const name = t.name || 'Unknown test';
  return `| ${name.substring(0, 60)}${name.length > 60 ? '...' : ''} | ${t.status} | ${t.duration || 0}ms |`;
}).join('\n')}
`).join('\n')}

## Full JSON

<details>
<summary>Click to expand raw JSON</summary>

\`\`\`json
${JSON.stringify(results, null, 2).substring(0, 10000)}
\`\`\`

</details>
`;
}

function generatePerEndpointReports(results: JestResult): Map<string, string> {
  const reports = new Map<string, string>();
  const endpointTests: Record<string, Array<{ suite: string; test: JestTestResult }>> = {};

  for (const suite of results.testResults) {
    const endpoint = extractEndpointFromTestName(suite.name);
    const safeName = endpoint.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();

    if (!endpointTests[safeName]) {
      endpointTests[safeName] = [];
    }

    for (const test of suite.assertionResults) {
      endpointTests[safeName].push({ suite: suite.name, test });
    }
  }

  for (const [safeName, tests] of Object.entries(endpointTests)) {
    const passed = tests.filter(t => t.test.status === 'passed').length;
    const failed = tests.filter(t => t.test.status === 'failed').length;

    const content = `# ${safeName.replace(/-/g, ' ').toUpperCase()}

Generated: ${new Date().toISOString()}

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${tests.length} |
| Passed | ${passed} |
| Failed | ${failed} |

## Test Cases

${tests.map(({ test }) => `
### ${test.name}

**Status:** ${test.status === 'passed' ? 'PASS' : 'FAIL'}
**Duration:** ${test.duration || 0}ms

${test.status === 'failed' ? `
**Error:**
\`\`\`
${(test.failureMessages?.[0] || 'No error message').substring(0, 300)}
\`\`\`
` : ''}
`).join('\n---\n')}

## Example Request/Response

See api-contract.md for canonical request/response examples.
`;

    reports.set(safeName, content);
  }

  return reports;
}

async function main(): Promise<void> {
  console.log('Contract Test Report Generator');
  console.log('==============================\n');

  // Parse Jest results
  const results = parseJestResults();
  if (!results) {
    console.error('No Jest results found. Run: yarn test:contract --json --outputFile=./test/contract/results.json');
    process.exit(1);
  }

  console.log(`Found ${results.numTotalTests} tests (${results.numPassedTests} passed, ${results.numFailedTests} failed)\n`);

  // Ensure output directories
  ensureDirectory(OUTPUT_DIR);
  ensureDirectory(path.join(OUTPUT_DIR, 'per-endpoint'));

  // Generate reports
  console.log('Generating reports...\n');

  const reports = [
    { name: 'README.md', content: generateReadme() },
    { name: 'summary.md', content: generateSummary(results) },
    { name: 'coverage-matrix.md', content: generateCoverageMatrix(results) },
    { name: 'findings.md', content: generateFindings(results) },
    { name: 'raw-results.md', content: generateRawResults(results) },
  ];

  for (const report of reports) {
    const filePath = path.join(OUTPUT_DIR, report.name);
    fs.writeFileSync(filePath, report.content, 'utf-8');
    console.log(`  Created: ${filePath}`);
  }

  // Generate per-endpoint reports
  const endpointReports = generatePerEndpointReports(results);
  for (const [name, content] of endpointReports) {
    const filePath = path.join(OUTPUT_DIR, 'per-endpoint', `${name}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  Created: ${filePath}`);
  }

  console.log(`\nReports generated at: ${OUTPUT_DIR}`);
}

main().catch(console.error);
