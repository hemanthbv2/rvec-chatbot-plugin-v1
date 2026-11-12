#!/usr/bin/env node
/**
 * Multi-File Asset Synchronization Engine
 * Ensures 100% bit-for-bit SHA-256 parity across all copies of script.js and telemetry.js.
 *
 * Usage:
 *   node scripts/sync_assets.js --sync   # Copy canonical files to targets and verify hashes
 *   node scripts/sync_assets.js --check  # Verify SHA-256 parity across all 12 files
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');

const ASSET_GROUPS = [
  {
    name: 'script.js',
    canonical: 'rvce-chatbot/script.js',
    targets: [
      'script.js',
      'rvce-chatbot/assets/script.js',
      'rvce-standalone-dashboard/public/script.js',
      'rvce-standalone-dashboard/public/chatbot-plugin-assets/script.js',
      'rvce-standalone-dashboard/public/chatbot-plugin-assets/assets/script.js'
    ]
  },
  {
    name: 'telemetry.js',
    canonical: 'rvce-chatbot/telemetry.js',
    targets: [
      'telemetry.js',
      'rvce-chatbot/assets/telemetry.js',
      'rvce-standalone-dashboard/public/chatbot-plugin-assets/telemetry.js',
      'rvce-standalone-dashboard/public/chatbot-plugin-assets/assets/telemetry.js',
      'rvce-standalone-dashboard/public/clarity-telemetry.js'
    ]
  }
];

function getSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

function syncAssets() {
  console.log('================================================================');
  console.log('SYNCING CANONICAL ASSETS TO ALL TARGETS');
  console.log('================================================================');

  let totalSynced = 0;
  let hasErrors = false;

  for (const group of ASSET_GROUPS) {
    const canonicalPath = path.resolve(REPO_ROOT, group.canonical);
    if (!fs.existsSync(canonicalPath)) {
      console.error(`[ERROR] Canonical file not found: ${group.canonical}`);
      process.exit(1);
    }

    const canonicalContent = fs.readFileSync(canonicalPath);
    const canonicalHash = getSha256(canonicalPath);
    console.log(`\nAsset Group: ${group.name}`);
    console.log(`Canonical Source: ${group.canonical} (${canonicalHash})`);

    for (const targetRel of group.targets) {
      const targetPath = path.resolve(REPO_ROOT, targetRel);
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.writeFileSync(targetPath, canonicalContent);
      const targetHash = getSha256(targetPath);

      if (targetHash === canonicalHash) {
        console.log(`  [SYNCED] ${targetRel} -> ${targetHash}`);
        totalSynced++;
      } else {
        console.error(`  [MISMATCH] ${targetRel} -> ${targetHash} !== ${canonicalHash}`);
        hasErrors = true;
      }
    }
  }

  console.log('\n================================================================');
  if (hasErrors) {
    console.error('FAILED: One or more targets failed to match canonical hash after sync.');
    process.exit(1);
  } else {
    console.log(`SUCCESS: All ${totalSynced} targets synced and verified with identical SHA-256.`);
  }
}

function checkAssets() {
  console.log('================================================================');
  console.log('CHECKING SHA-256 PARITY ACROSS ALL ASSETS');
  console.log('================================================================');

  let totalChecked = 0;
  let totalMatches = 0;
  let mismatches = [];

  for (const group of ASSET_GROUPS) {
    const canonicalPath = path.resolve(REPO_ROOT, group.canonical);
    console.log(`\nAsset Group: ${group.name}`);

    if (!fs.existsSync(canonicalPath)) {
      console.error(`  [ERROR] Canonical file missing: ${group.canonical}`);
      mismatches.push({ path: group.canonical, error: 'Canonical missing' });
      continue;
    }

    const canonicalHash = getSha256(canonicalPath);
    console.log(`  [CANONICAL] ${group.canonical} [${canonicalHash}]`);
    totalChecked++;
    totalMatches++;

    for (const targetRel of group.targets) {
      totalChecked++;
      const targetPath = path.resolve(REPO_ROOT, targetRel);

      if (!fs.existsSync(targetPath)) {
        console.error(`  [MISSING]   ${targetRel}`);
        mismatches.push({ path: targetRel, error: 'File missing' });
        continue;
      }

      const targetHash = getSha256(targetPath);
      if (targetHash === canonicalHash) {
        console.log(`  [MATCH]     ${targetRel} [${targetHash}]`);
        totalMatches++;
      } else {
        console.error(`  [MISMATCH]  ${targetRel}`);
        console.error(`              Expected: ${canonicalHash}`);
        console.error(`              Actual:   ${targetHash}`);
        mismatches.push({ path: targetRel, expected: canonicalHash, actual: targetHash });
      }
    }
  }

  console.log('\n================================================================');
  console.log(`Checked: ${totalChecked}/12 files | Matches: ${totalMatches}/12`);

  if (mismatches.length > 0) {
    console.error(`FAILED: ${mismatches.length} file(s) failed parity check.`);
    process.exit(1);
  } else {
    console.log('SUCCESS: All 12 copies of script.js and telemetry.js match canonical SHA-256 perfectly.');
    process.exit(0);
  }
}

function printUsage() {
  console.log('Usage:');
  console.log('  node scripts/sync_assets.js --check   Verify SHA-256 parity for all 12 files');
  console.log('  node scripts/sync_assets.js --sync    Synchronize canonical files to all targets and verify');
  process.exit(1);
}

// CLI argument parsing
const args = process.argv.slice(2);
if (args.includes('--sync')) {
  syncAssets();
} else if (args.includes('--check')) {
  checkAssets();
} else {
  printUsage();
}
