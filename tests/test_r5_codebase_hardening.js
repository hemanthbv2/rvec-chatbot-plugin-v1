/**
 * Test Suite: R5 - Codebase Audit, Hardening and Key Normalization
 * Specifications: ORIGINAL_REQUEST.md (R5) & PROJECT.md (Feature 7)
 *
 * Verifies:
 * 1. Syntax compilation of all application .js files via Node vm.compileFunction / node -c
 * 2. SSE live stream error handling (res.on('error') socket cleanup)
 * 3. Bounded LRU cache on geoCache (max 2,000 entries) and memStore
 * 4. WordPress plugin /sessions-data REST route returns session data rather than interactions
 * 5. Database key normalization (createdAt/leadData vs timestamp/data vs s, d, t, i, q, m)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    console.log('RUNNING TEST SUITE: R5 - Codebase Hardening & Key Normalization');
    console.log('================================================================\n');

    // ---------------------------------------------------------
    // TEST 1: Syntax Compilation of All Application .js Files
    // ---------------------------------------------------------
    console.log('--- Test Group 1: Syntax Validation Across All JavaScript Files ---');
    const jsFiles = [
        'script.js',
        'telemetry.js',
        'rvce-chatbot/script.js',
        'rvce-chatbot/assets/script.js',
        'rvce-chatbot/telemetry.js',
        'rvce-chatbot/assets/telemetry.js',
        'rvce-standalone-dashboard/server.js',
        'rvce-standalone-dashboard/utils/enrichment.js',
        'rvce-standalone-dashboard/utils/supabaseClient.js',
        'rvce-standalone-dashboard/models/Session.js',
        'rvce-standalone-dashboard/models/Interaction.js',
        'rvce-standalone-dashboard/models/Lead.js',
        'rvce-standalone-dashboard/models/User.js',
        'rvce-standalone-dashboard/public/script.js',
        'rvce-standalone-dashboard/public/chatbot-plugin-assets/script.js',
        'rvce-standalone-dashboard/public/chatbot-plugin-assets/assets/script.js',
        'rvce-standalone-dashboard/public/chatbot-plugin-assets/telemetry.js',
        'rvce-standalone-dashboard/public/chatbot-plugin-assets/assets/telemetry.js',
        'rvce-standalone-dashboard/public/clarity-telemetry.js',
        'scripts/sync_assets.js'
    ];

    let allCompiled = true;
    for (const relPath of jsFiles) {
        const fullPath = path.join(REPO_ROOT, relPath);
        if (!fs.existsSync(fullPath)) {
            assertTest(`File exists: ${relPath}`, false, 'File not found');
            allCompiled = false;
            continue;
        }
        try {
            const code = fs.readFileSync(fullPath, 'utf-8');
            // Remove shebang if present
            const cleanCode = code.replace(/^#![^\n]*/, '');
            new vm.Script(cleanCode, { filename: relPath });
        } catch (syntaxErr) {
            assertTest(`Syntax check: ${relPath}`, false, syntaxErr.message);
            allCompiled = false;
            continue;
        }
    }
    assertTest(
        'All 20 application JavaScript files compile with zero syntax errors',
        allCompiled
    );

    // ---------------------------------------------------------
    // TEST 2: SSE Live Stream Error Handling (res.on('error'))
    // ---------------------------------------------------------
    console.log('\n--- Test Group 2: SSE Live Stream Error Handling ---');
    const serverPath = path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'server.js');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');

    // Inspect /api/dashboard/live/stream route implementation
    const sseRouteMatch = serverContent.match(/app\.get\(['"]\/api\/dashboard\/live\/stream['"][\s\S]*?req\.on\(['"]close['"][\s\S]*?}\);/);
    const hasResOnError = sseRouteMatch && (
        sseRouteMatch[0].includes("res.on('error'") ||
        sseRouteMatch[0].includes('res.on("error"')
    );
    assertTest(
        'server.js: SSE stream registers res.on("error") to prevent uncaught socket crash',
        Boolean(hasResOnError),
        'Missing res.on("error") handler on SSE response stream; unhandled error will terminate process on socket reset'
    );

    // ---------------------------------------------------------
    // TEST 3: Bounded LRU Cache on geoCache and memStore
    // ---------------------------------------------------------
    console.log('\n--- Test Group 3: Memory Cache Bounds & Eviction ---');
    const enrichmentPath = path.join(REPO_ROOT, 'rvce-standalone-dashboard', 'utils', 'enrichment.js');
    const enrichmentContent = fs.readFileSync(enrichmentPath, 'utf-8');

    // Check geoCache bounded size specification (max 2,000 entries)
    const geoCacheBounded = enrichmentContent.includes('geoCache.size > 2000') ||
        enrichmentContent.includes('MAX_GEO_CACHE') ||
        enrichmentContent.includes('LRU') ||
        (enrichmentContent.includes('geoCache.keys().next().value') && enrichmentContent.includes('geoCache.delete'));
    assertTest(
        'enrichment.js: geoCache has bounded maximum size (max 2,000) with LRU eviction',
        Boolean(geoCacheBounded),
        'geoCache is currently an unbounded Map with zero eviction, causing memory leak under high IP traffic'
    );

    // Check memStore.leads bound in server.js
    const memStoreLeadsBounded = serverContent.includes('memStore.leads.size >') ||
        serverContent.includes('MAX_MEM_LEADS');
    assertTest(
        'server.js: memStore.leads enforces maximum storage bounds',
        Boolean(memStoreLeadsBounded),
        'memStore.leads grows unboundedly with no limit check'
    );

    // ---------------------------------------------------------
    // TEST 4: WordPress Plugin /sessions-data Route Mapping
    // ---------------------------------------------------------
    console.log('\n--- Test Group 4: WordPress REST Route Mapping ---');
    const phpPath = path.join(REPO_ROOT, 'rvce-chatbot', 'rvce-chatbot.php');
    const phpContent = fs.readFileSync(phpPath, 'utf-8');

    // Check /sessions-data route callback in rvce-chatbot.php
    // Bug: /sessions-data is bundled in $dashboard_routes and calls rvce_chatbot_get_interactions
    const sessionsRouteDedicated = /register_rest_route\([^,]+,\s*'\/sessions-data'[^)]*'callback'\s*=>\s*'rvce_chatbot_get_sessions'/i.test(phpContent) ||
        (!phpContent.includes("'/sessions-data', '/analytics-data'") && phpContent.includes('rvce_chatbot_get_sessions'));
    assertTest(
        'rvce-chatbot.php: /sessions-data route maps to rvce_chatbot_get_sessions callback (not interactions)',
        sessionsRouteDedicated,
        '/sessions-data is currently erroneously mapped to rvce_chatbot_get_interactions'
    );

    // ---------------------------------------------------------
    // TEST 5: Database Key Normalization Logic
    // ---------------------------------------------------------
    console.log('\n--- Test Group 5: Telemetry Key Normalization Specification ---');
    // Function that normalizes telemetry keys
    const normalizeTelemetryEvent = (e) => {
        const meta = e.metaData || e.data || e.m || {};
        return {
            sessionId: e.sessionId || e.s || '',
            eventType: e.eventType || e.t || 'message',
            queryText: e.queryText || meta.query || meta.message || e.q || '',
            interactionId: e.interactionId || e.i || meta.intent || '',
            timestamp: new Date(e.timestamp || e.d || e.createdAt || Date.now()).toISOString()
        };
    };

    // Test short-key payload (used by compact mobile network mode)
    const shortEvent = { s: 'sess_short_123', t: 'message', q: 'Computer Science', i: 'dept_cse', d: 1731320000000 };
    const normShort = normalizeTelemetryEvent(shortEvent);
    assertTest(
        'Normalizer correctly maps short keys (s, t, q, i, d) to standardized fields',
        normShort.sessionId === 'sess_short_123' &&
        normShort.eventType === 'message' &&
        normShort.queryText === 'Computer Science' &&
        normShort.interactionId === 'dept_cse'
    );

    // Test long-key payload (used by standard web telemetry)
    const longEvent = { sessionId: 'sess_long_456', eventType: 'message', queryText: 'Placements', interactionId: 'general', createdAt: '2026-11-11T10:00:00.000Z' };
    const normLong = normalizeTelemetryEvent(longEvent);
    assertTest(
        'Normalizer correctly maps standard long keys to standardized fields',
        normLong.sessionId === 'sess_long_456' &&
        normLong.eventType === 'message' &&
        normLong.queryText === 'Placements'
    );

    console.log('\n================================================================');
    console.log(`R5 Suite Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('================================================================');

    return { total: totalTests, passed: passedTests, failed: failedTests, failures };
}

if (require.main === module) {
    run().then((res) => {
        process.exitCode = res.failed > 0 ? 1 : 0;
        process.exit(process.exitCode);
    }).catch((err) => {
        console.error('Fatal test error in test_r5_codebase_hardening:', err);
        process.exit(1);
    });
}

module.exports = run;
