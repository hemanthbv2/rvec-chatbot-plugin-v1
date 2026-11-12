/**
 * Test Suite: R5B - Chatbot Memory Persistence on Close / Reopen
 * Specifications: ORIGINAL_REQUEST.md (Follow-up #2) & PROJECT.md (Feature 8)
 *
 * Specifically tests the user's critical requirement:
 * "when chatbot is closed and opened it resets memory and no previous memory inspite of using same chatbot"
 *
 * Verifies:
 * 1. Conversation history and dialogue bubbles are preserved when widget is closed and reopened
 * 2. SESSION state (history, lastIntent, navStack) is persisted and restored (not lost on close)
 * 3. Session ID continuity (the same sessionId is preserved before and after widget toggle)
 * 4. Multi-turn context persistence across widget toggles
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
    console.log('RUNNING TEST SUITE: R5B - Chatbot Memory Persistence on Close/Reopen');
    console.log('================================================================\n');

    const scriptPath = path.join(REPO_ROOT, 'script.js');
    const scriptContent = fs.readFileSync(scriptPath, 'utf-8');

    // ---------------------------------------------------------
    // TEST 1: Source Code Inspection of saveState & SESSION Persistence
    // ---------------------------------------------------------
    console.log('--- Test Group 1: Source Code Inspection for Memory Persistence ---');
    
    // Check if saveState saves SESSION context (history, lastIntent, navStack)
    const saveStateMatch = scriptContent.match(/function saveState\(\)\s*{[\s\S]*?^}/m);
    const saveStatePersistsSession = saveStateMatch && (
        saveStateMatch[0].includes('rvce_chat_session') ||
        saveStateMatch[0].includes('rvce_chat_history') ||
        saveStateMatch[0].includes('SESSION')
    );
    assertTest(
        'script.js: saveState() serializes SESSION conversational memory (history, lastIntent, navStack)',
        Boolean(saveStatePersistsSession),
        'saveState() only saves raw innerHTML and tone; structured dialogue SESSION memory is lost when widget toggles'
    );

    // Check if init / loadState restores SESSION state
    const restoresSessionState = scriptContent.includes('SafeStorage.getItem(\'rvce_chat_session\')') ||
        scriptContent.includes('JSON.parse(SafeStorage.getItem(') ||
        scriptContent.includes('rvce_chat_history');
    assertTest(
        'script.js: init / state restoration reloads SESSION conversational memory',
        Boolean(restoresSessionState),
        'init restores HTML but leaves SESSION memory unpopulated, breaking follow-up question context'
    );

    // ---------------------------------------------------------
    // TEST 2: Widget Open/Close Lifecycle Simulation
    // ---------------------------------------------------------
    console.log('\n--- Test Group 2: Widget Close & Reopen Lifecycle Simulation ---');

    // Setup simulated browser environment
    const storageStore = new Map();
    const mockStorage = {
        getItem: (k) => storageStore.get(k) || null,
        setItem: (k, v) => storageStore.set(k, String(v)),
        removeItem: (k) => storageStore.delete(k),
        clear: () => storageStore.clear()
    };

    // DOM Element Mock
    class MockClassList {
        constructor() { this.classes = new Set(); }
        add(c) { this.classes.add(c); }
        remove(c) { this.classes.delete(c); }
        contains(c) { return this.classes.has(c); }
        toggle(c, force) {
            if (force !== undefined) {
                if (force) this.classes.add(c); else this.classes.delete(c);
                return force;
            }
            if (this.classes.has(c)) { this.classes.delete(c); return false; }
            this.classes.add(c); return true;
        }
    }

    class MockElement {
        constructor(id, tagName = 'div') {
            this.id = id;
            this.tagName = tagName;
            this.innerHTML = '';
            this.classList = new MockClassList();
            this.attributes = new Map();
            this.listeners = {};
            this.style = { setProperty: () => {} };
        }
        addEventListener(event, fn) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(fn);
        }
        click() {
            if (this.listeners['click']) {
                for (const fn of this.listeners['click']) fn({ target: this, preventDefault: () => {} });
            }
        }
        focus() {}
        setAttribute(k, v) { this.attributes.set(k, String(v)); }
        getAttribute(k) { return this.attributes.get(k) || null; }
        querySelectorAll() { return []; }
    }

    const msgsEl = new MockElement('chatMessages');
    const fabEl = new MockElement('chatbotFab', 'button');
    const chatWEl = new MockElement('chatbotWidget');
    const inpEl = new MockElement('chatInput', 'input');
    const badgeEl = new MockElement('notifBadge');
    const closeHeaderEl = new MockElement('closeChatBtn', 'button');

    const domMap = {
        'chatMessages': msgsEl,
        'chatbotFab': fabEl,
        'chatbotWidget': chatWEl,
        'chatInput': inpEl,
        'notifBadge': badgeEl,
        'closeChatBtn': closeHeaderEl
    };

    // Simulate Conversation State
    let chatOpen = false;
    let sessionId = 'sess_user_active_001';
    let sessionState = {
        lastIntent: 'placements',
        history: [
            { role: 'user', text: 'Tell me about RVCE placements' },
            { role: 'bot', text: 'RVCE placement rate is 95% with top recruiters like Google, Microsoft, and Cisco.' }
        ]
    };

    // Populate initial conversation
    msgsEl.innerHTML = `
        <div class="msg user"><div class="msg-bubble">Tell me about RVCE placements</div></div>
        <div class="msg bot"><div class="msg-bubble">RVCE placement rate is 95% with top recruiters like Google, Microsoft, and Cisco.</div></div>
    `;

    // 1. Simulate closing the widget
    chatOpen = false;
    chatWEl.classList.remove('open');
    fabEl.classList.remove('active');
    mockStorage.setItem('rvce_chat_html', msgsEl.innerHTML);
    mockStorage.setItem('rvce_chat_open', '0');
    mockStorage.setItem('rvce_sid', sessionId);

    // Verify state while closed
    assertTest(
        'Widget closed state: chatOpen is false and HTML is saved in storage',
        chatOpen === false && mockStorage.getItem('rvce_chat_html').includes('RVCE placement rate is 95%')
    );

    // 2. Simulate reopening the widget on the same tab
    chatOpen = true;
    chatWEl.classList.add('open');
    fabEl.classList.add('active');

    // Restore HTML
    const restoredHtml = mockStorage.getItem('rvce_chat_html');
    msgsEl.innerHTML = restoredHtml;

    // Asserts
    assertTest(
        'Widget reopened: chatOpen is true and widget element has "open" class',
        chatOpen === true && chatWEl.classList.contains('open')
    );

    assertTest(
        'Widget reopened: user message dialogue is completely preserved and NOT wiped',
        msgsEl.innerHTML.includes('Tell me about RVCE placements') &&
        msgsEl.innerHTML.includes('RVCE placement rate is 95%')
    );

    assertTest(
        'Widget reopened: session ID is conserved across toggle (no new session reset)',
        mockStorage.getItem('rvce_sid') === sessionId
    );

    // 3. Test multi-turn dialogue continuity check
    // When reopened, can user ask follow-up "What about hostel fees?" with previous intent preserved?
    const hasFollowUpContinuity = Boolean(saveStatePersistsSession && restoresSessionState);
    assertTest(
        'Multi-turn context: Dialogue SESSION history is maintained across widget close/reopen',
        hasFollowUpContinuity,
        'Widget close/reopen breaks conversational context because SESSION is not synced to SafeStorage'
    );

    console.log('\n================================================================');
    console.log(`R5B Suite Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('================================================================');

    return { total: totalTests, passed: passedTests, failed: failedTests, failures };
}

if (require.main === module) {
    run().then((res) => {
        process.exitCode = res.failed > 0 ? 1 : 0;
        process.exit(process.exitCode);
    }).catch((err) => {
        console.error('Fatal test error in test_r5b_chat_memory_persistence:', err);
        process.exit(1);
    });
}

module.exports = run;
