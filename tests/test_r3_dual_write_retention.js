/**
 * Test Suite: R3 - Session Recording and Dual-Write Telemetry Retention
 * Specifications: ORIGINAL_REQUEST.md (R3) & PROJECT.md (Feature 4)
 *
 * Verifies:
 * 1. Telemetry queue retry on failure: pending batches retained & stored in offline queue rather than dropped
 * 2. visibilitychange & beforeunload dual-write dispatches (must dispatch to both WordPress & Vercel)
 * 3. Session timeout consistency (30 min across client components)
 * 4. Campus Wi-Fi / shared-IP non-collision: independent visitors with valid session IDs are never collapsed
 */

process.env.PORT = '0';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');
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
    console.log('RUNNING TEST SUITE: R3 - Dual-Write Telemetry Retention');
    console.log('================================================================\n');

    // ---------------------------------------------------------
    // TEST 1: Telemetry Queue Failure Retention & Offline Buffer
    // ---------------------------------------------------------
    console.log('--- Test Group 1: Telemetry Queue Retention on Dispatch Failure ---');
    const telemetryPath = path.join(REPO_ROOT, 'telemetry.js');
    const telemetryContent = fs.readFileSync(telemetryPath, 'utf-8');

    // Check if flushQueue catches errors and re-enqueues or persists failed batch
    const flushQueueMatch = telemetryContent.match(/async function flushQueue\(\)[\s\S]*?finally\s*{[\s\S]*?}/);
    const hasQueueRetry = flushQueueMatch && (
        flushQueueMatch[0].includes('telemetryQueue.unshift') ||
        flushQueueMatch[0].includes('telemetryQueue.push(...batch)') ||
        flushQueueMatch[0].includes('offline') ||
        /catch[\s\S]*?telemetryQueue/.test(flushQueueMatch[0])
    );
    assertTest(
        'telemetry.js: flushQueue retains failed batch in queue or offline buffer on dispatch failure',
        Boolean(hasQueueRetry),
        'Currently clears telemetryQueue = [] and permanently drops all events if sendBatch() fails'
    );

    // Check for offline localStorage buffer mechanism
    const hasOfflineBuffer = telemetryContent.includes('offlineQueue') ||
        telemetryContent.includes('rvce_offline_telemetry') ||
        telemetryContent.includes('offlineStorage');
    assertTest(
        'telemetry.js: offline localStorage queue implemented for network resilience',
        hasOfflineBuffer,
        'No offline localStorage queue found in telemetry.js'
    );

    // ---------------------------------------------------------
    // TEST 2: Dual-Write on Unload & VisibilityChange
    // ---------------------------------------------------------
    console.log('\n--- Test Group 2: visibilitychange & beforeunload Dual-Write Dispatches ---');
    // Check for visibilitychange listener
    const hasVisibilityListener = telemetryContent.includes('visibilitychange');
    assertTest(
        'telemetry.js: registers visibilitychange event listener for mobile/tab-switch retention',
        hasVisibilityListener,
        'Missing document.addEventListener("visibilitychange") listener'
    );

    // Check beforeunload listener sends to BOTH targets (dual-write)
    const beforeUnloadMatch = telemetryContent.match(/window\.addEventListener\(['"]beforeunload['"][\s\S]*?}\);/);
    const hasDualWriteOnUnload = beforeUnloadMatch && (
        (beforeUnloadMatch[0].includes('wpRestUrl') || beforeUnloadMatch[0].includes('wp-json')) &&
        (beforeUnloadMatch[0].includes('vercelUrl') || beforeUnloadMatch[0].includes('centralBase') || beforeUnloadMatch[0].includes('/api/logs'))
    );
    assertTest(
        'telemetry.js: beforeunload dispatches to BOTH WordPress and Vercel/Node backends (dual-write)',
        Boolean(hasDualWriteOnUnload),
        'Currently beforeunload only dispatches to centralBase (Vercel) and completely ignores WordPress'
    );

    // ---------------------------------------------------------
    // TEST 3: Session Timeout Consistency (30 min)
    // ---------------------------------------------------------
    console.log('\n--- Test Group 3: Session Timeout Consistency (30 Minutes) ---');
    const telemetryTimeoutMatch = telemetryContent.match(/SESSION_TIMEOUT_MS\s*=\s*([^;]+);/);
    const scriptPath = path.join(REPO_ROOT, 'script.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    // Telemetry timeout must evaluate to 30 * 60 * 1000 = 1,800,000 ms
    let telemetryTimeoutVal = 0;
    if (telemetryTimeoutMatch) {
        try { telemetryTimeoutVal = eval(telemetryTimeoutMatch[1]); } catch (e) {}
    }
    assertTest(
        'telemetry.js: SESSION_TIMEOUT_MS equals exactly 30 minutes (1,800,000 ms)',
        telemetryTimeoutVal === 30 * 60 * 1000,
        `Expected 1800000 ms, got ${telemetryTimeoutVal} ms`
    );

    // script.js session expiry check (must align with 30 min rolling window)
    const scriptClearsAfter2Hours = scriptContent.includes('7200000');
    assertTest(
        'script.js: session rolling expiry aligns with 30-minute standard instead of 2-hour drift',
        !scriptClearsAfter2Hours,
        'script.js currently uses 7200000 ms (2 hours) creating a 90-minute session discrepancy with telemetry.js'
    );

    // ---------------------------------------------------------
    // TEST 4: Campus Wi-Fi / Shared-IP Non-Collision
    // ---------------------------------------------------------
    console.log('\n--- Test Group 4: Campus Wi-Fi Shared-IP Non-Collision ---');
    const serverPath = path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');

    // Extract getCanonicalSessionId implementation from server.js
    const canonFnMatch = serverContent.match(/function getCanonicalSessionId\([^)]*\)\s*{[\s\S]*?return rawSessionId;?\s*}/);
    assertTest('server.js defines getCanonicalSessionId', Boolean(canonFnMatch));

    // Simulate two distinct campus visitors on the same IP and identical browser
    // e.g. two RVCE library desktop machines sharing gateway IP 10.104.22.50
    const testCanonicalCollapse = () => {
        const sandbox = {
            clientSessionBindings: new Map()
        };
        const fnCode = `${canonFnMatch[0]}; result = { getCanonicalSessionId };`;
        vm.runInNewContext(fnCode, sandbox);
        const { getCanonicalSessionId } = sandbox.result;

        const sharedFingerprint = '10.104.22.50:Mozilla/5.0 RVCE Library';
        const sessionVisitorA = 'sess_student_alpha_' + Date.now();
        const sessionVisitorB = 'sess_student_beta_' + Date.now();

        // Visitor A registers
        const canonicalA = getCanonicalSessionId(sessionVisitorA, sharedFingerprint);
        
        // Visitor B registers 2 seconds later from the same campus Wi-Fi / IP
        const canonicalB = getCanonicalSessionId(sessionVisitorB, sharedFingerprint);

        return { canonicalA, canonicalB, sessionVisitorA, sessionVisitorB };
    };

    const { canonicalA, canonicalB, sessionVisitorA, sessionVisitorB } = testCanonicalCollapse();
    assertTest(
        'Visitor A retains their own session ID',
        canonicalA === sessionVisitorA
    );
    assertTest(
        'Visitor B on shared campus Wi-Fi retains their own unique session ID and is NOT collapsed into Visitor A',
        canonicalB === sessionVisitorB,
        `Collision detected: Visitor B (${sessionVisitorB}) was collapsed into Visitor A (${canonicalB}) due to clientFingerprint binding`
    );

    console.log('\n================================================================');
    console.log(`R3 Suite Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('================================================================');

    return { total: totalTests, passed: passedTests, failed: failedTests, failures };
}

if (require.main === module) {
    run().then((res) => {
        process.exitCode = res.failed > 0 ? 1 : 0;
        process.exit(process.exitCode);
    }).catch((err) => {
        console.error('Fatal test error in test_r3_dual_write_retention:', err);
        process.exit(1);
    });
}

module.exports = run;
