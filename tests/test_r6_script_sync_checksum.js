/**
 * Test Suite: R6 - Asset Synchronization and Checksum Verification
 * Specifications: ORIGINAL_REQUEST.md (R6) & PROJECT.md (Feature 9)
 *
 * Verifies:
 * 1. scripts/sync_assets.js --check runs cleanly
 * 2. Exit code is strictly 0
 * 3. Exactly 12/12 copies of script.js and telemetry.js match canonical SHA-256 hashes bit-for-bit
 */

const { spawnSync } = require('child_process');
const path = require('path');

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
    console.log('RUNNING TEST SUITE: R6 - Asset Synchronization Checksums');
    console.log('================================================================\n');

    console.log('--- Executing: node scripts/sync_assets.js --check ---');
    const syncScript = path.join(REPO_ROOT, 'scripts', 'sync_assets.js');
    
    const result = spawnSync(process.execPath, [syncScript, '--check'], {
        cwd: REPO_ROOT,
        encoding: 'utf-8'
    });

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';

    // Test 1: Exit code 0
    assertTest(
        'sync_assets.js --check completes with exit code 0',
        result.status === 0,
        `Process exited with code ${result.status}. Stderr: ${stderr}`
    );

    // Test 2: All 12 files verified
    const checkedMatch = stdout.match(/Checked:\s*(\d+)\/12/);
    const checkedCount = checkedMatch ? parseInt(checkedMatch[1]) : 0;
    assertTest(
        'sync_assets.js --check checks exactly 12 asset files',
        checkedCount === 12,
        `Expected 12 files checked, got ${checkedCount}`
    );

    // Test 3: 12/12 matches
    const matchesMatch = stdout.match(/Matches:\s*(\d+)\/12/);
    const matchesCount = matchesMatch ? parseInt(matchesMatch[1]) : 0;
    assertTest(
        'All 12 copies of script.js and telemetry.js match canonical SHA-256 hashes perfectly',
        matchesCount === 12,
        `Expected 12/12 matches, got ${matchesCount}/12`
    );

    // Test 4: Success confirmation in stdout
    assertTest(
        'Stdout reports SUCCESS confirmation for all 12 asset copies',
        stdout.includes('SUCCESS: All 12 copies of script.js and telemetry.js match canonical SHA-256 perfectly.')
    );

    console.log('\n================================================================');
    console.log(`R6 Suite Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('================================================================');

    return { total: totalTests, passed: passedTests, failed: failedTests, failures };
}

if (require.main === module) {
    run().then((res) => {
        process.exitCode = res.failed > 0 ? 1 : 0;
        process.exit(process.exitCode);
    }).catch((err) => {
        console.error('Fatal test error in test_r6_script_sync_checksum:', err);
        process.exit(1);
    });
}

module.exports = run;
