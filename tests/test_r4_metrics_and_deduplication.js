/**
 * Test Suite: R4 - Metrics Accuracy and Deduplication Integrity
 * Specifications: ORIGINAL_REQUEST.md (R4) & PROJECT.md (Feature 6)
 *
 * Verifies:
 * 1. Global variable pollution prevention: totalInteractions and totalSessions must NOT leak into Node's `global`
 * 2. Overview metrics count accuracy: counts must match segment counts and not artificially clamp to 500
 * 3. Idempotent lead insertion: duplicate lead submissions for the same candidate/session update existing lead
 *    rather than creating duplicate rows
 * 4. Multi-target deduplication endpoint (/api/dashboard/records/deduplicate)
 */

process.env.PORT = '0';
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
    console.log('RUNNING TEST SUITE: R4 - Metrics Accuracy & Deduplication');
    console.log('================================================================\n');

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

    const mongoose = require('../rvce-standalone-dashboard/node_modules/mongoose');
    // Wait up to 3 seconds for Mongo connection if connecting
    let waitCount = 0;
    while (mongoose.connection.readyState !== 1 && waitCount < 30) {
        await new Promise(r => setTimeout(r, 100));
        waitCount++;
    }

    try {
        // ---------------------------------------------------------
        // TEST 1: Global Variable Pollution Prevention
        // ---------------------------------------------------------
        console.log('--- Test Group 1: Global Scope Variable Pollution ---');
        // Delete any existing leaked globals before request
        delete global.totalInteractions;
        delete global.totalSessions;

        // Hit /api/dashboard/overview
        const ovRes = await fetch(`${baseUrl}/api/dashboard/overview?segment=users`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        await ovRes.json();

        assertTest(
            'global.totalInteractions is NOT polluted by overview handler',
            typeof global.totalInteractions === 'undefined',
            `Leaked into global: global.totalInteractions = ${global.totalInteractions}`
        );

        assertTest(
            'global.totalSessions is NOT polluted by overview handler',
            typeof global.totalSessions === 'undefined',
            `Leaked into global: global.totalSessions = ${global.totalSessions}`
        );

        // ---------------------------------------------------------
        // TEST 2: Overview Count Clamping Specification
        // ---------------------------------------------------------
        console.log('\n--- Test Group 2: Unclamped Metric Counts (>500 records) ---');
        const serverFileContent = fs.readFileSync(path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'server.js'), 'utf-8');
        
        // Inspect getUnifiedSessions limit in server.js
        const unifiedMatch = serverFileContent.match(/async function getUnifiedSessions[\s\S]*?return (?:sessions|cachedUnifiedSessions);?\s*}/);
        const has500Clamp = unifiedMatch && unifiedMatch[0].includes('.limit(500)');
        assertTest(
            'server.js: getUnifiedSessions does not artificially clamp sessions list to 500 records',
            !has500Clamp,
            'getUnifiedSessions() contains .limit(500) which truncates analytics when database exceeds 500 records'
        );

        // Check if segment counts use database countDocuments rather than filteredSessions.length (which is capped at 500)
        const overviewFnMatch = serverFileContent.match(/app\.get\(['"]\/api\/dashboard\/overview['"][\s\S]*?res\.json\({[\s\S]*?}\);/);
        const hasUsersClampFix = overviewFnMatch && overviewFnMatch[0].includes('totalSessionsVal = (segment === \'users\'');
        assertTest(
            'server.js: overview totalSessions uses countUsers for segment=users rather than clamped array length',
            Boolean(hasUsersClampFix),
            'Overview uses filteredSessions.length for segment="users", capping metric to 500'
        );

        // ---------------------------------------------------------
        // TEST 3: Idempotent Lead Upsert
        // ---------------------------------------------------------
        console.log('\n--- Test Group 3: Idempotent Lead Insertion ---');
        const leadSessionId = 'sess_r4_lead_' + Date.now();
        const candidatePayload = {
            name: 'Ananya Sharma',
            email: 'ananya.s@rvce.edu.in',
            phone: '9845012345',
            program: 'B.Tech AI & Data Science'
        };

        // Ingest Lead submission #1
        const leadRes1 = await fetch(`${baseUrl}/api/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: leadSessionId,
                subsite: 'main',
                events: [
                    {
                        eventType: 'form_submit',
                        metaData: candidatePayload,
                        timestamp: new Date().toISOString()
                    }
                ]
            })
        });
        assertTest('First lead submission ingested successfully', leadRes1.ok);

        // Ingest Lead submission #2 with identical contact details in same session
        const leadRes2 = await fetch(`${baseUrl}/api/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: leadSessionId,
                subsite: 'main',
                events: [
                    {
                        eventType: 'form_submit',
                        metaData: { ...candidatePayload, updatedNote: 'Interested in hostel' },
                        timestamp: new Date().toISOString()
                    }
                ]
            })
        });
        assertTest('Second duplicate lead submission ingested', leadRes2.ok);

        // Fetch leads from CRM API
        const leadsListRes = await fetch(`${baseUrl}/api/dashboard/leads`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const leadsData = await leadsListRes.json();
        const leadList = Array.isArray(leadsData) ? leadsData : (leadsData.leads || []);
        const matchingLeads = leadList.filter(l =>
            (l.sessionId === leadSessionId) ||
            (l.data?.email === candidatePayload.email) ||
            (l.leadData?.email === candidatePayload.email)
        );

        assertTest(
            'Idempotent lead insertion: Duplicate lead submission does NOT create multiple duplicate rows',
            matchingLeads.length <= 1,
            `Found ${matchingLeads.length} lead records for the same candidate submission (expected 1 upserted record)`
        );

        // ---------------------------------------------------------
        // TEST 4: Multi-Target Deduplication Endpoint
        // ---------------------------------------------------------
        console.log('\n--- Test Group 4: Administrative Deduplication Endpoint ---');
        const dedupRes = await fetch(`${baseUrl}/api/dashboard/records/deduplicate`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const dedupData = await dedupRes.json();
        assertTest(
            'POST /api/dashboard/records/deduplicate returns ok:true with summary counts',
            dedupRes.status === 200 && dedupData.ok === true && typeof dedupData.removedInteractions === 'number',
            `Expected { ok: true, removedInteractions: number }, got ${JSON.stringify(dedupData)}`
        );

    } finally {
        await new Promise((resolve) => server.close(resolve));
    }

    console.log('\n================================================================');
    console.log(`R4 Suite Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('================================================================');

    return { total: totalTests, passed: passedTests, failed: failedTests, failures };
}

if (require.main === module) {
    run().then((res) => {
        process.exitCode = res.failed > 0 ? 1 : 0;
        process.exit(process.exitCode);
    }).catch((err) => {
        console.error('Fatal test error in test_r4_metrics_and_deduplication:', err);
        process.exit(1);
    });
}

module.exports = run;
