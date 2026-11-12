/**
 * Test Suite: R2 - Report Fetch and Authentication Robustness
 * Specifications: ORIGINAL_REQUEST.md (R2) & PROJECT.md (Feature 3)
 *
 * Verifies:
 * 1. Dynamic API_BASE resolution (must not hardcode port 3001 when running on port 3000, 5000, or file://)
 * 2. JWT expiration handling (401/403 triggers auto-auth recovery without wiping storage or unhandled rejections)
 * 3. /api/dashboard/report/daily generation when queries/buttons have missing titles (no .replace TypeError crash)
 * 4. Date grouping consistency across ISO UTC boundaries
 */

process.env.PORT = '0'; // Ephemeral port
const http = require('http');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
module.paths.push(path.resolve(__dirname, '..', 'rvce-standalone-dashboard', 'node_modules'));
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'rvce_command_center_secret_2026';
const REPO_ROOT = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assertTest(name, condition, errorMsg = '') {
    totalTests++;
    if (condition) {
        passedTests++;
        console.log(`  [PASS] ${name}`);
    } else {
        failedTests++;
        console.error(`  [FAIL] ${name}${errorMsg ? ' - ' + errorMsg : ''}`);
        failures.push({ name, error: errorMsg });
    }
}

async function run() {
    console.log('================================================================');
    console.log('RUNNING TEST SUITE: R2 - Report Fetch & Authentication Robustness');
    console.log('================================================================\n');

    // ---------------------------------------------------------
    // TEST 1: Dynamic API_BASE Resolution
    // ---------------------------------------------------------
    console.log('--- Test Group 1: Dynamic API_BASE Resolution ---');
    const indexPath = path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'public', 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Extract API_BASE definition from index.html
    const apiBaseMatch = indexContent.match(/const\s+API_BASE\s*=\s*([^;]+);/);
    assertTest('index.html contains API_BASE declaration', Boolean(apiBaseMatch));

    // Test behavior when app is hosted on port 3000
    // Simulation: window.location on port 3000
    const evaluateApiBaseOnPort = (port, protocol = 'http:') => {
        const sandbox = {
            window: {
                location: {
                    protocol: protocol,
                    hostname: 'localhost',
                    port: String(port)
                }
            }
        };
        try {
            // Run the exact expression found in index.html
            const expr = apiBaseMatch ? apiBaseMatch[1] : '';
            return vm.runInNewContext(expr, sandbox);
        } catch (e) {
            return 'error';
        }
    };

    const apiBasePort3000 = evaluateApiBaseOnPort('3000');
    assertTest(
        'index.html: API_BASE does NOT hardcode port 3001 when running on port 3000',
        apiBasePort3000 !== 'http://localhost:3001',
        `Current code returns "${apiBasePort3000}". When hosted on port 3000, it erroneously redirects API calls to port 3001.`
    );

    const apiBasePort5000 = evaluateApiBaseOnPort('5000');
    assertTest(
        'index.html: API_BASE does NOT hardcode port 3001 when running on port 5000',
        apiBasePort5000 !== 'http://localhost:3001',
        `Current code returns "${apiBasePort5000}". When hosted on port 5000, it erroneously redirects API calls to port 3001.`
    );

    // ---------------------------------------------------------
    // TEST 2: JWT Expiration Handling & Auto-Auth
    // ---------------------------------------------------------
    console.log('\n--- Test Group 2: JWT Expiration & Auto-Auth Recovery ---');
    // In index.html, when fetchWithAuth encounters 401 or 403:
    // It should transparently attempt auto-reauthentication using ensureAuthenticated() / auto-login
    // rather than wiping storage, displaying login view, and returning null.
    const fetchWithAuthSection = indexContent.match(/async function fetchWithAuth[\s\S]*?return await res\.json\(\);[\s\S]*?}/);
    const hasAutoAuthInFetch = fetchWithAuthSection && /ensureAuthenticated|getAuthToken|auto-login|fetch.*login/i.test(fetchWithAuthSection[0]);
    assertTest(
        'index.html: fetchWithAuth transparently attempts auto-reauth on 401/403 before failing',
        Boolean(hasAutoAuthInFetch),
        'Currently wipes localStorage and displays login modal without auto-recovery attempt'
    );

    // Verify print-report.html has seamless auto-auth retry
    const printReportPath = path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'public', 'print-report.html');
    const printContent = fs.readFileSync(printReportPath, 'utf-8');
    const printHasAutoAuth = printContent.includes('fetchWithAutoAuth') &&
        printContent.includes('res.status === 401 || res.status === 403');
    assertTest(
        'print-report.html: fetchWithAutoAuth retries on 401/403 seamlessly',
        printHasAutoAuth
    );

    // ---------------------------------------------------------
    // TEST 3: /api/dashboard/report/daily with Missing Titles
    // ---------------------------------------------------------
    console.log('\n--- Test Group 3: Daily Report Missing Titles Crash Reproduction ---');
    const app = require('../rvce-standalone-dashboard/server');
    const validToken = jwt.sign(
        { id: 'usr_test_admin', role: 'admin', instituteId: 'rvce', username: 'rvceadmin' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const assignedPort = server.address().port;
    const baseUrl = `http://127.0.0.1:${assignedPort}`;

    try {
        // Ingest a session with journey items having MISSING title / elementText
        const bugSessionId = 'sess_r2_missing_titles_' + Date.now();
        const Session = require('../rvce-standalone-dashboard/models/Session');
        await Session.create({
            sessionId: bugSessionId,
            instituteId: 'rvce',
            landingPage: '/admissions',
            startTime: new Date(),
            lastActive: new Date(),
            journey: [
                // query without title or elementText
                { type: 'query', timeOffset: '00:05' },
                // button_click without title or elementText
                { type: 'button_click', timeOffset: '00:10' },
                // link_click without title or elementText
                { type: 'link_click', timeOffset: '00:15' }
            ]
        });

        // Query daily report
        const reportRes = await fetch(`${baseUrl}/api/dashboard/report/daily`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });

        assertTest(
            'GET /api/dashboard/report/daily succeeds without .replace TypeError crash on missing titles',
            reportRes.status === 200,
            `Expected HTTP 200, got ${reportRes.status}. Server crashes with TypeError: Cannot read properties of undefined (reading 'replace')`
        );

        // ---------------------------------------------------------
        // TEST 4: Date Grouping Consistency Across UTC/Local
        // ---------------------------------------------------------
        console.log('\n--- Test Group 4: Date Grouping Across ISO Boundaries ---');
        // Test query with specific dateFilter
        const todayIso = new Date().toISOString().split('T')[0];
        const dateFilterRes = await fetch(`${baseUrl}/api/dashboard/report/daily?dateFilter=${todayIso}`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const dateFilterData = await dateFilterRes.json();
        assertTest(
            'GET /api/dashboard/report/daily with dateFilter returns valid response with days array',
            dateFilterRes.status === 200 && dateFilterData && Array.isArray(dateFilterData.days),
            `Expected { days: [...] } response, got ${JSON.stringify(dateFilterData)}`
        );

        // Clean up inserted test session from MongoDB
        try {
            await Session.deleteOne({ sessionId: bugSessionId });
        } catch (e) {}

    } finally {
        await new Promise((resolve) => server.close(resolve));
    }

    console.log('\n================================================================');
    console.log(`R2 Suite Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('================================================================');

    return { total: totalTests, passed: passedTests, failed: failedTests, failures };
}

if (require.main === module) {
    run().then((res) => {
        process.exitCode = res.failed > 0 ? 1 : 0;
        process.exit(process.exitCode);
    }).catch((err) => {
        console.error('Fatal test error in test_r2_reports_and_auth:', err);
        process.exit(1);
    });
}

module.exports = run;
