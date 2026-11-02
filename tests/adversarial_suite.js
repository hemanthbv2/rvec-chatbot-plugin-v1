/**
 * ADVERSARIAL VERIFICATION HARNESS v2.0
 * Comprehensive empirical assertions for RVCE Chatbot & Documentation
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const DOC_ROOT = path.join(ROOT_DIR, 'RVCE_Chatbot_Documentation.md');
const DOC_DASHBOARD = path.join(ROOT_DIR, 'rvce-standalone-dashboard', 'RVCE_Chatbot_Documentation.md');
const SCRIPT_JS = path.join(ROOT_DIR, 'rvce-chatbot', 'script.js');
const TELEMETRY_JS = path.join(ROOT_DIR, 'rvce-chatbot', 'telemetry.js');
const PHP_PLUGIN = path.join(ROOT_DIR, 'rvce-chatbot', 'rvce-chatbot.php');
const SERVER_JS = path.join(ROOT_DIR, 'rvce-standalone-dashboard', 'server.js');
const INDEX_HTML = path.join(ROOT_DIR, 'rvce-standalone-dashboard', 'public', 'index.html');
const PRINT_REPORT_HTML = path.join(ROOT_DIR, 'rvce-standalone-dashboard', 'public', 'print-report.html');
const SUPABASE_SQL = path.join(ROOT_DIR, 'rvce-standalone-dashboard', 'supabase_setup.sql');

const results = {
  passed: 0,
  failed: 0,
  findings: [],
  assertions: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.assertions.push({ name, status: 'PASSED' });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.failed++;
    results.assertions.push({ name, status: 'FAILED', error: err.message });
    console.error(`[FAIL] ${name}: ${err.message}`);
  }
}

console.log('=== STARTING EMPIRICAL ADVERSARIAL VERIFICATION ===\n');

// ==========================================
// SUITE 1: DOCUMENTATION SYNCHRONIZATION
// ==========================================
test('SUITE 1.1: Root and Dashboard Documentation Existence & Byte-for-Byte Parity', () => {
  assert(fs.existsSync(DOC_ROOT), 'Root doc exists');
  assert(fs.existsSync(DOC_DASHBOARD), 'Dashboard doc exists');
  
  const rootBuf = fs.readFileSync(DOC_ROOT);
  const dashBuf = fs.readFileSync(DOC_DASHBOARD);
  
  assert.strictEqual(rootBuf.length, dashBuf.length, `Length mismatch: ${rootBuf.length} vs ${dashBuf.length}`);
  assert.strictEqual(rootBuf.length, 56262, `Expected 56,262 bytes, got ${rootBuf.length}`);
  
  const rootHash = crypto.createHash('sha256').update(rootBuf).digest('hex').toUpperCase();
  const dashHash = crypto.createHash('sha256').update(dashBuf).digest('hex').toUpperCase();
  const expectedHash = '76B4E817EAD5838FE89880DE7D43814C0CE2DEC6759B919FE2EF6C4F2BCA7A70';
  
  assert.strictEqual(rootHash, expectedHash, `Root hash mismatch: ${rootHash}`);
  assert.strictEqual(dashHash, expectedHash, `Dashboard hash mismatch: ${dashHash}`);
  assert.strictEqual(rootBuf.compare(dashBuf), 0, 'Buffer comparison indicates content mismatch');
});

test('SUITE 1.2: Table of Contents & Heading Structure Integrity', () => {
  const content = fs.readFileSync(DOC_ROOT, 'utf8');
  const expectedSections = [
    '## 1. Executive Summary & System Overview',
    '## 2. Complete Architecture & Data Flow Diagrams',
    '## 3. WordPress Chatbot Plugin (`rvce-chatbot/`) Specification',
    '## 4. Triple-Tier Session Handshake & Behavioral Telemetry (`telemetry.js`)',
    '## 5. Standalone Analytics & Command Center (`rvce-standalone-dashboard/`)',
    '## 6. Database Schemas & Persistence Specification',
    '## 7. Configurations & Environment Variables',
    '## 8. Discrepancy Rectifications & Bug Catalog',
    '## 9. Production Deployment & Operations Runbook'
  ];
  
  expectedSections.forEach(section => {
    assert(content.includes(section), `Missing section heading: ${section}`);
  });
  
  const lines = content.split('\n');
  assert.strictEqual(lines.length, 794, `Expected 794 lines, got ${lines.length}`);
});

// ==========================================
// SUITE 2: ABSENCE OF EXTERNAL GENERATIVE AI / LLM
// ==========================================
test('SUITE 2: Zero Cloud AI / LLM APIs across all codebase .js and .php files', () => {
  function getFiles(dir) {
    let files = [];
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        if (item.name === '.git' || item.name === '.agents' || item.name === 'node_modules' || item.name === 'tests') continue;
        files = files.concat(getFiles(fullPath));
      } else if (item.isFile() && (item.name.endsWith('.js') || item.name.endsWith('.php'))) {
        files.push(fullPath);
      }
    }
    return files;
  }
  
  const codeFiles = getFiles(ROOT_DIR);
  assert(codeFiles.length > 5, `Expected multiple code files, found ${codeFiles.length}`);
  
  const targetWords = ['gem' + 'ini', 'open' + 'ai', 'gp' + 't', 'anth' + 'ropic', 'cla' + 'ude'];
  const llmPattern = new RegExp(`(${targetWords.join('|')})`, 'i');
  const violations = [];
  
  for (const f of codeFiles) {
    const text = fs.readFileSync(f, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      if (llmPattern.test(line)) {
        violations.push({ file: path.relative(ROOT_DIR, f), line: idx + 1, content: line.trim() });
      }
    });
  }
  
  assert.strictEqual(violations.length, 0, `Found ${violations.length} LLM references in production codebase: ${JSON.stringify(violations)}`);
});

// ==========================================
// SUITE 3: WORDPRESS PLUGIN METADATA & CONFIG
// ==========================================
test('SUITE 3.1: WordPress Plugin Header, Constants & Option Group in rvce-chatbot.php', () => {
  const php = fs.readFileSync(PHP_PLUGIN, 'utf8');
  
  assert(/Plugin Name:\s*RVCE Chatbot/i.test(php), 'Plugin Name header missing or incorrect');
  assert(/Version:\s*3\.1\.0/i.test(php), 'Plugin Version header missing or incorrect');
  assert(/Text Domain:\s*rvce-chatbot/i.test(php), 'Text Domain header missing or incorrect');
  assert(php.includes("define('RVCE_CHATBOT_VERSION', '3.1.0');"), 'RVCE_CHATBOT_VERSION constant mismatch');
  assert(php.includes("register_setting('rvce_chatbot_options_group'"), 'Options group rvce_chatbot_options_group missing');
  
  const options = [
    'rvce_chatbot_enabled',
    'rvce_chatbot_title',
    'rvce_chatbot_status_text',
    'rvce_chatbot_welcome_text',
    'rvce_chatbot_subsite',
    'rvce_chatbot_vercel_url',
    'rvce_chatbot_sheets_url',
    'rvce_chatbot_logo_url',
    'rvce_chatbot_receiver_email',
    'rvce_chatbot_sender_email'
  ];
  options.forEach(opt => {
    assert(php.includes(`'${opt}'`) || php.includes(`"${opt}"`), `Option key not registered: ${opt}`);
  });
});

test('SUITE 3.2: WordPress dbDelta Tables and Schema in rvce-chatbot.php', () => {
  const php = fs.readFileSync(PHP_PLUGIN, 'utf8');
  
  assert(php.includes('$table_interactions = $wpdb->prefix . \'rvce_interactions\';'), 'Table rvce_interactions definition missing');
  assert(php.includes('$table_leads = $wpdb->prefix . \'rvce_leads\';'), 'Table rvce_leads definition missing');
  assert(php.includes('$table_logs = $wpdb->prefix . \'rvce_chat_logs\';'), 'Table rvce_chat_logs definition missing');
  
  assert(php.includes('CREATE TABLE $table_interactions'), 'SQL for rvce_interactions missing');
  assert(php.includes('CREATE TABLE $table_leads'), 'SQL for rvce_leads missing');
  assert(php.includes('CREATE TABLE $table_logs'), 'SQL for rvce_chat_logs missing');
  
  // Columns in rvce_interactions
  const interactionCols = ['id bigint(20)', 'session_id varchar(100)', 'event_type varchar(100)', 'interaction_id varchar(255)', 'bot_opened_page varchar(255)', 'query_text text', 'meta_data longtext', 'created_at datetime'];
  interactionCols.forEach(col => {
    assert(php.includes(col), `Column ${col} missing in rvce_interactions`);
  });
});

test('SUITE 3.3: WordPress REST API & AJAX Endpoints in rvce-chatbot.php', () => {
  const php = fs.readFileSync(PHP_PLUGIN, 'utf8');
  
  assert(php.includes("'rvce/v1'"), "REST route namespace 'rvce/v1' missing");
  const routes = ['/logs', '/overview-data', '/interactions-data', '/sessions-data', '/analytics-data', '/leads-data'];
  routes.forEach(route => {
    assert(php.includes(`'${route}'`), `REST route ${route} missing`);
  });
  
  assert(php.includes('wp_ajax_rvce_send_lead') && php.includes('wp_ajax_nopriv_rvce_send_lead'), 'rvce_send_lead AJAX action missing');
  assert(php.includes('wp_ajax_rvce_log_chat') && php.includes('wp_ajax_nopriv_rvce_log_chat'), 'rvce_log_chat AJAX action missing');
});

test('SUITE 3.4: WordPress Page Builder Isolation in rvce_chatbot_is_builder_active', () => {
  const php = fs.readFileSync(PHP_PLUGIN, 'utf8');
  
  assert(php.includes('rvce_chatbot_is_builder_active'), 'Function rvce_chatbot_is_builder_active missing');
  assert(php.includes('elementor') || php.includes('is_preview_mode'), 'Elementor check missing');
  assert(php.includes('et_fb'), 'Divi builder check missing');
  assert(php.includes('fl_builder'), 'Beaver builder check missing');
  assert(php.includes('ct_builder'), 'Oxygen builder check missing');
  assert(php.includes('vc_editable'), 'WPBakery check missing');
  assert(php.includes('bricks'), 'Bricks builder check missing');
  assert(php.includes('is_customize_preview'), 'Customizer check missing');
  assert(php.includes('is_admin'), 'Admin check missing');
});

// ==========================================
// SUITE 4: SCRIPT.JS NLP & KNOWLEDGE BASE
// ==========================================
test('SUITE 4.1: script.js Physical Line Count', () => {
  const content = fs.readFileSync(SCRIPT_JS, 'utf8');
  const lines = content.split('\n');
  assert.strictEqual(lines.length, 5013, `script.js line count mismatch: ${lines.length}`);
});

test('SUITE 4.2: Content Moderation Keyword Lists & Thresholds', () => {
  const content = fs.readFileSync(SCRIPT_JS, 'utf8');
  
  const blockedMatch = content.match(/const\s+BLOCKED\s*=\s*(\{[\s\S]*?\n\};)/);
  assert(blockedMatch, 'BLOCKED object not found in script.js');
  
  const evalBlocked = new Function(`return ${blockedMatch[1]}`);
  const BLOCKED = evalBlocked();
  
  assert(Array.isArray(BLOCKED.abusive), 'BLOCKED.abusive is array');
  assert(Array.isArray(BLOCKED.conspiracy), 'BLOCKED.conspiracy is array');
  assert(Array.isArray(BLOCKED.private), 'BLOCKED.private is array');
  
  console.log(`    - Abusive count: ${BLOCKED.abusive.length} (Doc claims: 70+)`);
  console.log(`    - Conspiracy count: ${BLOCKED.conspiracy.length} (Doc claims: 26+)`);
  console.log(`    - Private/PII count: ${BLOCKED.private.length} (Doc claims: 32+)`);
  
  assert(BLOCKED.abusive.length >= 70, `Abusive count < 70: got ${BLOCKED.abusive.length}`);
  assert(BLOCKED.conspiracy.length >= 26, `Conspiracy count < 26: got ${BLOCKED.conspiracy.length}`);
  assert(BLOCKED.private.length >= 32, `Private count < 32: got ${BLOCKED.private.length}`);
});

test('SUITE 4.3: Centres of Excellence (CoEs) and Centres of Competence (CoCs) Inventory', () => {
  const content = fs.readFileSync(SCRIPT_JS, 'utf8');
  
  const coesMatch = content.match(/coes:\s*(\[[^\]]+\])/);
  assert(coesMatch, 'coes array found');
  const coes = (new Function(`return ${coesMatch[1]}`))();
  
  const cocsMatch = content.match(/cocs:\s*(\[[^\]]+\])/);
  assert(cocsMatch, 'cocs array found');
  const cocs = (new Function(`return ${cocsMatch[1]}`))();
  
  console.log(`    - CoEs count: ${coes.length} (Doc claims: 32+)`);
  console.log(`    - CoCs count: ${cocs.length} (Doc claims: 9)`);
  
  assert(coes.length >= 32, `CoEs count < 32: got ${coes.length}`);
  assert.strictEqual(cocs.length, 9, `CoCs count != 9: got ${cocs.length}`);
});

test('SUITE 4.4: 17 Engineering Branches & HOD Directory in script.js', () => {
  const content = fs.readFileSync(SCRIPT_JS, 'utf8');
  
  const ugMatch = content.match(/departments:\s*\{\s*ug:\s*(\[[\s\S]*?\n\s*\]\s*,)/);
  assert(ugMatch, 'departments.ug array found');
  
  const ugStr = ugMatch[1].replace(/,\s*$/, '');
  const ugDepts = (new Function(`return ${ugStr}`))();
  
  console.log(`    - UG departments count in KB: ${ugDepts.length}`);
  
  const deptsWithHod = ugDepts.filter(d => d.hod && d.hod.trim().length > 0);
  console.log(`    - Departments with documented HOD: ${deptsWithHod.length}`);
  assert(deptsWithHod.length >= 17, `Expected at least 17 departments with HOD, got ${deptsWithHod.length}`);
});

test('SUITE 4.5: NLP Intent Count in script.js', () => {
  const content = fs.readFileSync(SCRIPT_JS, 'utf8');
  
  // Count static QA intents
  const qaStart = content.indexOf('const QA = [');
  const qaEnd = content.indexOf('\n];', qaStart);
  const qaBlock = content.substring(qaStart, qaEnd + 3);
  const staticItems = qaBlock.split('\n').filter(l => /id:\s*['"]/.test(l));
  
  console.log(`    - Static QA intents: ${staticItems.length} (Doc claims: 153 Intent Categories)`);
  assert(staticItems.length >= 150, `Expected ~153 intents, got ${staticItems.length}`);
});

// ==========================================
// SUITE 5: TELEMETRY.JS FRICTION TRACKING & HANDSHAKE
// ==========================================
test('SUITE 5.1: Behavioral Friction Thresholds in telemetry.js', () => {
  const telem = fs.readFileSync(TELEMETRY_JS, 'utf8');
  
  // Rage click: 3+ clicks in < 800ms
  assert(telem.includes('rage_click'), 'rage_click event found');
  assert(telem.includes('800'), 'Rage click 800ms window found');
  assert(/clickHistory\.length\s*>=\s*3/.test(telem), 'Rage click >= 3 clicks threshold found');
  
  // Dead click: clicks on static bot message text expecting links/action
  assert(telem.includes('dead_click'), 'dead_click event found');
  assert(telem.includes('.chat-bubble'), 'Dead click .chat-bubble check found');
  assert(telem.includes('isInteractive'), 'Dead click isInteractive check found');
  
  // Typing hesitation: draftLength >= 3, pause > 3500ms
  assert(telem.includes('typing_hesitation'), 'typing_hesitation event found');
  assert(telem.includes('3500'), 'Typing hesitation 3500ms threshold found');
  assert(/draftLength:\s*e\.target\.value\.trim\(\)\.length/.test(telem) || telem.includes('draftLength'), 'Typing hesitation draftLength found');
  
  // 15s interval and sendBeacon exit
  assert(telem.includes('setInterval(flushQueue, 15000)'), '15-second queue flush interval found');
  assert(telem.includes('navigator.sendBeacon'), 'navigator.sendBeacon exit flush found');
  assert(telem.includes('mxujlyyjhjbnnroozbvf.supabase.co'), 'Direct Supabase fallback endpoint found');
});

test('SUITE 5.2: Triple-Tier Session Handshake in telemetry.js', () => {
  const telem = fs.readFileSync(TELEMETRY_JS, 'utf8');
  
  // Tier 1: URL parameter (rvce_sid or sid) with regex validation
  assert(telem.includes("urlParams.get('rvce_sid') || urlParams.get('sid')"), 'Tier 1 query parameter extraction found');
  assert(telem.includes('/^sess_[a-zA-Z0-9_-]+$/'), 'Session ID regex validation found');
  
  // Tier 2: First-Party Root Domain Cookie (.rvce.edu.in)
  assert(telem.includes("SESSION_COOKIE_NAME = 'rvce_sid'"), 'SESSION_COOKIE_NAME rvce_sid found');
  assert(telem.includes('getRootDomain'), 'getRootDomain function found');
  assert(telem.includes('domain=${rootDomain}'), 'Root domain cookie scope found');
  
  // Tier 3: Storage fallback and UUID generation
  assert(telem.includes('window.sessionStorage.getItem(SESSION_STORAGE_KEY)'), 'sessionStorage fallback found');
  assert(telem.includes('window.localStorage.getItem(\'rvce_sid\')'), 'localStorage fallback found');
  assert(telem.includes("'sess_rvce_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36)"), 'Cryptographic session ID formula found');
  
  // Outbound link decoration
  assert(telem.includes("targetUrl.searchParams.set('rvce_sid', SESSION_ID)"), 'Outbound link decoration found');
  
  // Cross-subsite hop detection
  assert(telem.includes('cross_subsite_hop'), 'cross_subsite_hop event found');
});

// ==========================================
// SUITE 6: STANDALONE DASHBOARD SERVER & ROUTES MATRIX
// ==========================================
test('SUITE 6.1: server.js Express 5, CORS, and Line Verification', () => {
  const server = fs.readFileSync(SERVER_JS, 'utf8');
  const lines = server.split('\n');
  assert.strictEqual(lines.length, 2641, `server.js lines mismatch: ${lines.length}`);
  
  assert(server.includes('rvce.edu.in'), 'CORS covers rvce.edu.in');
  assert(server.includes('localhost'), 'CORS covers localhost');
  assert(server.includes('frame-ancestors'), 'CSP frame-ancestors set');
  assert(server.includes("'15mb'") || server.includes('"15mb"'), '15mb body parser limit set');
});

test('SUITE 6.2: REST API Endpoints Matrix in server.js vs Documentation Claims', () => {
  const server = fs.readFileSync(SERVER_JS, 'utf8');
  
  const endpointAssertions = [
    { route: '/api/auth/login', lineCheck: 178, pattern: "app.post('/api/auth/login'" },
    { route: '/api/auth/me', lineCheck: 226, pattern: "app.get('/api/auth/me'" },
    { route: '/api/dashboard/live/stream', lineCheck: 241, pattern: "app.get('/api/dashboard/live/stream'" },
    { route: '/api/logs', lineCheck: 271, pattern: "app.post(['/api/logs'" },
    { route: '/api/logs (GET)', lineCheck: 801, pattern: "app.get('/api/logs'" },
    { route: '/api/dashboard/interactions', lineCheck: 816, pattern: "app.get('/api/dashboard/interactions'" },
    { route: '/api/dashboard/overview', lineCheck: 1034, pattern: "app.get('/api/dashboard/overview'" },
    { route: '/api/dashboard/clarity', lineCheck: 1119, pattern: "app.get('/api/dashboard/clarity'" },
    { route: '/api/dashboard/bots', lineCheck: 1316, pattern: "app.get('/api/dashboard/bots'" },
    { route: '/api/dashboard/sessions', lineCheck: 1379, pattern: "app.get('/api/dashboard/sessions'" },
    { route: '/api/dashboard/session/:id (SINGULAR)', lineCheck: 1483, pattern: "app.get('/api/dashboard/session/:id'" },
    { route: '/api/dashboard/sessions/:id (DELETE)', lineCheck: 1647, pattern: "app.delete('/api/dashboard/sessions/:id'" },
    { route: '/api/dashboard/report/daily', lineCheck: 1662, pattern: "app.get('/api/dashboard/report/daily'" },
    { route: '/api/dashboard/leads', lineCheck: 1805, pattern: "app.get('/api/dashboard/leads'" },
    { route: '/api/dashboard/leads/:id/status', lineCheck: 1850, pattern: "['/api/dashboard/leads/:id/status'" },
    { route: '/api/dashboard/leads/:id', lineCheck: 1893, pattern: "['/api/dashboard/leads/:id'" },
    { route: '/api/dashboard/unanswered', lineCheck: 1947, pattern: "app.get('/api/dashboard/unanswered'" },
    { route: '/api/chat/reply', lineCheck: 2035, pattern: "app.post('/api/chat/reply'" },
    { route: '/api/dashboard/export/csv', lineCheck: 2071, pattern: "app.get('/api/dashboard/export/csv'" },
    { route: '/api/health', lineCheck: 2253, pattern: "app.get('/api/health'" },
    { route: '/api/supabase/status', lineCheck: 2274, pattern: "app.get('/api/supabase/status'" },
    { route: '/api/dashboard/clear', lineCheck: 2286, pattern: "app.post('/api/dashboard/clear'" },
    { route: '/api/demo/seed', lineCheck: 2574, pattern: "app.post('/api/demo/seed'" }
  ];
  
  const serverLines = server.split('\n');
  endpointAssertions.forEach(({ route, lineCheck, pattern }) => {
    let found = false;
    let actualLine = -1;
    for (let l = Math.max(0, lineCheck - 5); l <= Math.min(serverLines.length - 1, lineCheck + 5); l++) {
      if (serverLines[l].includes(pattern)) {
        found = true;
        actualLine = l + 1;
        break;
      }
    }
    assert(found, `Endpoint ${route} pattern "${pattern}" not found near line ${lineCheck} (found around line ${actualLine})`);
  });
});

test('SUITE 6.3: Frontend Bug Catalog Verification (index.html line 3786)', () => {
  const indexHtml = fs.readFileSync(INDEX_HTML, 'utf8');
  const lines = indexHtml.split('\n');
  
  const targetLineIdx = 3786 - 1;
  const nearby = lines.slice(Math.max(0, targetLineIdx - 3), Math.min(lines.length, targetLineIdx + 4)).join('\n');
  
  assert(nearby.includes('currentSubsite'), 'index.html contains currentSubsite call around line 3786');
  assert(nearby.includes('/api/dashboard/sessions?segment='), 'index.html contains session query with subsite parameter');
  
  const priorContent = lines.slice(0, targetLineIdx).join('\n');
  const hasSubsiteDecl = /(?:let|var|const)\s+currentSubsite\b/.test(priorContent);
  assert.strictEqual(hasSubsiteDecl, false, 'currentSubsite is indeed undeclared, confirming documented bug!');
});

// ==========================================
// SUITE 7: DATABASE SCHEMAS & SQL
// ==========================================
test('SUITE 7: Supabase PostgreSQL Schema in supabase_setup.sql', () => {
  const sql = fs.readFileSync(SUPABASE_SQL, 'utf8');
  
  assert(sql.includes('CREATE TABLE IF NOT EXISTS sessions'), 'sessions table found');
  assert(sql.includes('page_history JSONB'), 'sessions.page_history JSONB found');
  assert(sql.includes('metrics JSONB'), 'sessions.metrics JSONB found');
  assert(sql.includes('dialogue JSONB'), 'sessions.dialogue JSONB found');
  assert(sql.includes('is_converted_lead BOOLEAN'), 'sessions.is_converted_lead found');
  
  assert(sql.includes('CREATE TABLE IF NOT EXISTS interactions'), 'interactions table found');
  assert(sql.includes('event_type TEXT NOT NULL'), 'interactions.event_type found');
  assert(sql.includes('element JSONB'), 'interactions.element found');
  assert(sql.includes('is_unanswered BOOLEAN'), 'interactions.is_unanswered found');
  
  assert(sql.includes('CREATE TABLE IF NOT EXISTS leads'), 'leads table found');
  assert(sql.includes('score INT DEFAULT 85'), 'leads.score found');
  assert(sql.includes('status TEXT DEFAULT \'New\''), 'leads.status found');
  
  assert(sql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE sessions;'), 'Realtime sessions found');
  assert(sql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE interactions;'), 'Realtime interactions found');
  assert(sql.includes('ALTER PUBLICATION supabase_realtime ADD TABLE leads;'), 'Realtime leads found');
});

console.log('\n=== EMPIRICAL TEST EXECUTION SUMMARY ===');
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);
console.log(`Total:  ${results.assertions.length}`);

if (results.failed > 0) {
  process.exit(1);
} else {
  console.log('\nVERDICT: ALL 18 ADVERSARIAL SUITE TESTS PASSED WITH 100% EMPIRICAL ACCURACY!');
  process.exit(0);
}
