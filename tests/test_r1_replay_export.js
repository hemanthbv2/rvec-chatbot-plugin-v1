/**
 * Test Suite: R1 - Replay Drawer Export Resolution
 * Specifications: ORIGINAL_REQUEST.md (R1) & PROJECT.md (Feature 2)
 *
 * Verifies:
 * 1. Session ID sanitization: stripping single, double, repeated, and URI-encoded ^(?:Replay:\s*)+ prefixes
 * 2. Backend export endpoints (/api/dashboard/sessions/:id/export and /api/dashboard/session/:id/export)
 *    for both JSON and CSV formats with valid auth and 404 for missing sessions
 * 3. Client-side sanitization in downloadActiveDrawerSession (index.html) and print-report.html
 */

process.env.PORT = '0'; // Ephemeral port to avoid conflicts
const http = require('http');
const fs = require('fs');
const path = require('path');
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
    console.log('RUNNING TEST SUITE: R1 - Replay Drawer Export Resolution');
    console.log('================================================================\n');

    // ---------------------------------------------------------
    // TEST 1: Session ID Sanitization Specification Logic
    // ---------------------------------------------------------
    console.log('--- Test Group 1: Session ID Prefix Sanitization Regex Logic ---');
    const sanitizeSessionIdSpec = (raw) => {
        if (!raw) return '';
        let decoded = String(raw).trim();
        try { decoded = decodeURIComponent(decoded); } catch (e) {}
        return decoded.replace(/^(?:Replay:\s*)+/i, '').trim();
    };

    assertTest('Sanitize plain session ID', sanitizeSessionIdSpec('sess_12345') === 'sess_12345');
    assertTest('Sanitize single Replay: prefix', sanitizeSessionIdSpec('Replay: sess_12345') === 'sess_12345');
    assertTest('Sanitize double Replay: Replay: prefix', sanitizeSessionIdSpec('Replay: Replay: sess_12345') === 'sess_12345');
    assertTest('Sanitize multi-space double Replay:   Replay:  prefix', sanitizeSessionIdSpec('Replay:   Replay:  sess_12345') === 'sess_12345');
    assertTest('Sanitize URI-encoded Replay:%20 prefix', sanitizeSessionIdSpec('Replay:%20sess_12345') === 'sess_12345');
    assertTest('Sanitize double URI-encoded Replay%3A%20Replay%3A%20 prefix', sanitizeSessionIdSpec('Replay%3A%20Replay%3A%20sess_12345') === 'sess_12345');

    // ---------------------------------------------------------
    // TEST 2: Client-side Code Sanitization Verification
    // ---------------------------------------------------------
    console.log('\n--- Test Group 2: Client-Side Source Sanitization Inspection ---');
    const indexPath = path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'public', 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    
    // Check downloadActiveDrawerSession sanitization regex in index.html
    const drawerFnMatch = indexContent.match(/function downloadActiveDrawerSession[\s\S]*?raw\.replace\(([\s\S]*?),\s*['"]/);
    const hasDrawerMultiSanitize = drawerFnMatch && drawerFnMatch[1].includes('(?:Replay:\\s*)+');
    assertTest(
        'index.html: downloadActiveDrawerSession uses ^(?:Replay:\\s*)+ regex',
        Boolean(hasDrawerMultiSanitize),
        'Currently uses single /^Replay:\\s*/i which leaves double Replay: prefixes unstripped'
    );

    // Check print-report.html sanitization
    const printReportPath = path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'public', 'print-report.html');
    const printReportContent = fs.readFileSync(printReportPath, 'utf-8');
    const printSanitizesSession = /targetSessionId\s*=\s*.*replace\(.*Replay/i.test(printReportContent) ||
        /cleanTargetSessionId|sanitizedSessionId/i.test(printReportContent);
    assertTest(
        'print-report.html: targetSessionId sanitizes Replay: prefix before fetching export',
        printSanitizesSession,
        'Currently passes targetSessionId uncleaned to /api/dashboard/sessions/:id/export'
    );

    // ---------------------------------------------------------
    // TEST 3: Express Backend Export Endpoints
    // ---------------------------------------------------------
    console.log('\n--- Test Group 3: Backend Export Endpoints (JSON & CSV) ---');
    const app = require('../rvce-standalone-dashboard/server');
    const testToken = jwt.sign(
        { id: 'usr_test_admin', role: 'admin', instituteId: 'rvce', username: 'rvceadmin' },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    // Seed test session into in-memory store
    const testSessionId = 'sess_r1_export_' + Date.now();
    const testSession = {
        sessionId: testSessionId,
        instituteId: 'rvce',
        landingPage: '/admissions',
        entryPage: '/admissions',
        exitPage: '/departments',
        startTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        metrics: { messageCount: 2, eventCount: 5 },
        device: { type: 'Desktop', os: 'Windows', browser: 'Chrome' },
        geo: { city: 'Bengaluru', country: 'India' },
        journeySteps: [
            { type: 'page_load', title: 'Visited Admissions', action: 'page_load', timestamp: new Date().toISOString(), location: 'Webpage' },
            { type: 'message', title: 'Asked: "Fee Structure"', action: 'query', query: 'Fee Structure', botReply: 'B.Tech fees is 2.5L/year', timestamp: new Date().toISOString(), location: 'Chatbot' }
        ],
        dialogue: [
            { sender: 'user', role: 'user', text: 'Fee Structure', timestamp: new Date().toISOString() },
            { sender: 'bot', role: 'bot', text: 'B.Tech fees is 2.5L/year', timestamp: new Date().toISOString() }
        ]
    };

    // Access memStore from server module if available, or populate via endpoints
    const serverFileContent = fs.readFileSync(path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'server.js'), 'utf-8');
    
    // We start the express app on an ephemeral port
    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const assignedPort = server.address().port;
    const baseUrl = `http://127.0.0.1:${assignedPort}`;

    try {
        // Ingest test session via /api/logs
        const logRes = await fetch(`${baseUrl}/api/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: testSessionId,
                subsite: 'main',
                events: [
                    { eventType: 'page_load', pageUrl: 'https://rvce.edu.in/admissions', pageTitle: 'Admissions' },
                    { eventType: 'message', queryText: 'Fee Structure', botReply: 'B.Tech fees is 2.5L/year' }
                ]
            })
        });
        const logData = await logRes.json();
        assertTest('Setup: Test session ingested via /api/logs', logRes.ok && logData.success === true);

        // Subtest 3A: Export JSON format with clean ID
        const jsonRes = await fetch(`${baseUrl}/api/dashboard/sessions/${testSessionId}/export?format=json`, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        const jsonData = await jsonRes.json();
        assertTest(
            'GET /api/dashboard/sessions/:id/export?format=json returns 200 with session dossier',
            jsonRes.status === 200 && jsonData.ok === true && jsonData.sessionId === testSessionId,
            `Expected HTTP 200 with ok:true, got ${jsonRes.status}`
        );

        // Subtest 3B: Export CSV format with clean ID
        const csvRes = await fetch(`${baseUrl}/api/dashboard/sessions/${testSessionId}/export?format=csv`, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        const csvText = await csvRes.text();
        assertTest(
            'GET /api/dashboard/sessions/:id/export?format=csv returns 200 text/csv with header row',
            csvRes.status === 200 && csvRes.headers.get('content-type')?.includes('text/csv') && csvText.includes('Step,Timestamp,Type'),
            `Expected CSV response, got status ${csvRes.status}`
        );

        // Subtest 3C: Route alias /api/dashboard/session/:id/export
        const aliasRes = await fetch(`${baseUrl}/api/dashboard/session/${testSessionId}/export?format=json`, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        assertTest(
            'GET /api/dashboard/session/:id/export (singular alias) returns 200',
            aliasRes.status === 200
        );

        // Subtest 3D: Export with single Replay: prefix
        const singleReplayRes = await fetch(`${baseUrl}/api/dashboard/sessions/${encodeURIComponent('Replay: ' + testSessionId)}/export?format=json`, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        assertTest(
            'GET /api/dashboard/sessions/Replay: <id>/export succeeds (single prefix)',
            singleReplayRes.status === 200
        );

        // Subtest 3E: Export with double Replay: Replay: prefix (reproduction test)
        const doubleReplayRes = await fetch(`${baseUrl}/api/dashboard/sessions/${encodeURIComponent('Replay: Replay: ' + testSessionId)}/export?format=json`, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        assertTest(
            'GET /api/dashboard/sessions/Replay: Replay: <id>/export succeeds (double prefix)',
            doubleReplayRes.status === 200,
            `Got HTTP ${doubleReplayRes.status}. Server regex /^Replay:\\s*/i does not strip repeated prefixes.`
        );

        // Subtest 3F: Missing session returns 404
        const missingRes = await fetch(`${baseUrl}/api/dashboard/sessions/sess_nonexistent_99999/export?format=json`, {
            headers: { 'Authorization': `Bearer ${testToken}` }
        });
        assertTest(
            'GET /api/dashboard/sessions/:id/export returns 404 for non-existent session',
            missingRes.status === 404
        );

    } finally {
        await new Promise((resolve) => server.close(resolve));
    }

    console.log('\n================================================================');
    console.log(`R1 Suite Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('================================================================');

    return { total: totalTests, passed: passedTests, failed: failedTests, failures };
}

if (require.main === module) {
    run().then((res) => {
        process.exit(res.failed > 0 ? 1 : 0);
    }).catch((err) => {
        console.error('Fatal test error in test_r1_replay_export:', err);
        process.exit(1);
    });
}

module.exports = run;
