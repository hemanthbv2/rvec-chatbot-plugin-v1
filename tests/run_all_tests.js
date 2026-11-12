#!/usr/bin/env node
/**
 * Master Test Runner: RVCE Chatbot & Dashboard Hardening
 * Executes all reproduction test suites (R1 to R6, R3B, R5B)
 *
 * Usage:
 *   node tests/run_all_tests.js
 *
 * Exit Codes:
 *   0: All tests passed
 *   1: One or more tests failed (or bugs reproduced)
 */

const { spawnSync } = require('child_process');
const path = require('path');

const TESTS = [
    { file: 'test_r1_replay_export.js', name: 'R1: Replay Drawer Export Resolution' },
    { file: 'test_r2_reports_and_auth.js', name: 'R2: Reports Fetch & Auth Hardening' },
    { file: 'test_r3_dual_write_retention.js', name: 'R3: Dual-Write & Telemetry Retention' },
    { file: 'test_r3b_session_visibility.js', name: 'R3B: Session Visibility & Recordings Retention' },
    { file: 'test_r4_metrics_and_deduplication.js', name: 'R4: Metrics Accuracy & Deduplication' },
    { file: 'test_r5_codebase_hardening.js', name: 'R5: Codebase Hardening & Key Normalization' },
    { file: 'test_r5b_chat_memory_persistence.js', name: 'R5B: Chatbot Memory Persistence on Close/Reopen' },
    { file: 'test_r6_script_sync_checksum.js', name: 'R6: Asset Synchronization Checksum Verification' }
];

const TESTS_DIR = __dirname;
const startTime = Date.now();

console.log('====================================================================================================');
console.log('RVCE CHATBOT & STANDALONE COMMAND CENTER — AUTOMATED TEST SUITE RUNNER');
console.log('====================================================================================================\n');

const suiteResults = [];
let overallPass = true;
let totalPassedCount = 0;
let totalFailedCount = 0;
let totalTestsCount = 0;

for (const test of TESTS) {
    const filePath = path.join(TESTS_DIR, test.file);
    const suiteStart = Date.now();

    console.log(`>>> Executing Suite: ${test.file}...`);
    const proc = spawnSync(process.execPath, [filePath], {
        cwd: path.resolve(__dirname, '..'),
        encoding: 'utf-8',
        timeout: 30000 // 30s timeout per suite
    });

    const duration = Date.now() - suiteStart;
    const stdout = proc.stdout || '';
    const stderr = proc.stderr || '';
    const exitCode = proc.status;

    // Parse counts from output
    const finishedMatch = stdout.match(/Finished:\s*(\d+)\/(\d+)\s*Passed\s*\((\d+)\s*Failed\)/);
    let passed = 0;
    let total = 0;
    let failed = 0;

    if (finishedMatch) {
        passed = parseInt(finishedMatch[1]);
        total = parseInt(finishedMatch[2]);
        failed = parseInt(finishedMatch[3]);
    } else {
        // Fallback count from stdout
        passed = (stdout.match(/\[PASS\]/g) || []).length;
        failed = (stdout.match(/\[FAIL\]/g) || []).length;
        total = passed + failed;
    }

    const suitePassed = (exitCode === 0) && (failed === 0);
    if (!suitePassed) overallPass = false;

    totalPassedCount += passed;
    totalFailedCount += failed;
    totalTestsCount += total;

    suiteResults.push({
        file: test.file,
        name: test.name,
        passed: suitePassed,
        testsTotal: total,
        testsPassed: passed,
        testsFailed: failed,
        duration: duration,
        exitCode: exitCode
    });

    console.log(`    Result: ${suitePassed ? 'PASS' : 'FAIL'} (${passed}/${total} passed, duration: ${duration}ms)\n`);
}

// Print Structured Summary Table
console.log('====================================================================================================');
console.log('TEST SUITE EXECUTION SUMMARY TABLE');
console.log('====================================================================================================');
console.log(
    'Test Suite File'.padEnd(38) + ' | ' +
    'Status'.padEnd(6) + ' | ' +
    'Passed'.padEnd(8) + ' | ' +
    'Failed'.padEnd(8) + ' | ' +
    'Total'.padEnd(8) + ' | ' +
    'Duration'
);
console.log('-'.repeat(38) + '-+-' + '-'.repeat(6) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(8) + '-+-' + '-'.repeat(10));

for (const res of suiteResults) {
    const statusStr = res.passed ? 'PASS' : 'FAIL';
    console.log(
        res.file.padEnd(38) + ' | ' +
        statusStr.padEnd(6) + ' | ' +
        String(res.testsPassed).padEnd(8) + ' | ' +
        String(res.testsFailed).padEnd(8) + ' | ' +
        String(res.testsTotal).padEnd(8) + ' | ' +
        `${res.duration}ms`
    );
}

console.log('====================================================================================================');
const totalDuration = Date.now() - startTime;
console.log(`TOTAL SUITES: ${suiteResults.length} | PASSED SUITES: ${suiteResults.filter(s => s.passed).length} | FAILED SUITES: ${suiteResults.filter(s => !s.passed).length}`);
console.log(`TOTAL ASSERTIONS: ${totalTestsCount} | PASSED: ${totalPassedCount} | FAILED (REPRODUCED BUGS): ${totalFailedCount}`);
console.log(`TOTAL TIME: ${(totalDuration / 1000).toFixed(2)}s`);
console.log(`OVERALL STATUS: ${overallPass ? 'ALL TESTS PASSED' : 'REPRODUCTIONS CONFIRMED (FAILS EXPECTED ON UNFIXED CODE)'}`);
console.log('====================================================================================================');

process.exit(overallPass ? 0 : 1);
