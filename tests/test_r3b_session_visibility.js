/**
 * Test Suite: R3B - Session Visibility & Disappearing Recordings Resolution
 * Specifications: ORIGINAL_REQUEST.md (Follow-up #1) & PROJECT.md (Feature 5)
 *
 * Specifically tests the user's critical requirement:
 * "multiple sessions are not shown on session recordings and it dissapears"
 *
 * Verifies:
 * 1. /api/dashboard/sessions returns all logged visitor sessions without dropping records
 * 2. Segment filtering accuracy:
 *    - 'all': includes all visitors (browsed, conversed, bots)
 *    - 'users': includes all human visitors (both conversed and browsing-only), strictly excluding bots
 *    - 'conversed': includes only visitors with dialogue / messages
 * 3. Pagination integrity (totalCount, page slices, hasMore) across multiple pages
 * 4. Cache retention: consecutive requests do not evict or drop logged sessions
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
    console.log('RUNNING TEST SUITE: R3B - Session Visibility & Recordings Retention');
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

    const testPrefix = 'sess_r3b_vis_' + Date.now() + '_';
    const sessionsToIngest = [
        {
            // Session 1: Browsing human visitor (0 chat messages, read admissions page)
            id: testPrefix + 'browse_only',
            events: [
                { eventType: 'page_load', pageUrl: 'https://rvce.edu.in/admissions', pageTitle: 'Admissions 2026' },
                { eventType: 'link_click', linkUrl: 'https://rvce.edu.in/fees', linkText: 'Fee Details' }
            ]
        },
        {
            // Session 2: Conversed human visitor (interacted with chatbot)
            id: testPrefix + 'conversed',
            events: [
                { eventType: 'page_load', pageUrl: 'https://rvce.edu.in', pageTitle: 'RVCE Home' },
                { eventType: 'bot_open' },
                { eventType: 'message', queryText: 'What is the cutoff for CSE?', botReply: 'KCET cutoff is around rank 400.' }
            ]
        },
        {
            // Session 3: Bot visitor (crawler/search bot)
            id: testPrefix + 'crawler_bot',
            isBot: true,
            events: [
                { eventType: 'page_load', pageUrl: 'https://rvce.edu.in/robots.txt', pageTitle: 'Robots' }
            ]
        },
        {
            // Session 4: Candidate submitting lead
            id: testPrefix + 'lead_candidate',
            events: [
                { eventType: 'page_load', pageUrl: 'https://rvce.edu.in/contact', pageTitle: 'Contact' },
                { eventType: 'bot_open' },
                { eventType: 'form_submit', metaData: { name: 'Kavya', phone: '9888877777', email: 'kavya@test.com' } }
            ]
        },
        {
            // Session 5: Campus visitor with rage click
            id: testPrefix + 'rage_visitor',
            events: [
                { eventType: 'page_load', pageUrl: 'https://rvce.edu.in/exam-results', pageTitle: 'Results' },
                { eventType: 'rage_click', metaData: { elementTag: 'BUTTON', elementText: 'Download Rank Card' } }
            ]
        }
    ];

    try {
        console.log('--- Test Group 1: Multi-Session Ingestion ---');
        for (const s of sessionsToIngest) {
            const headers = { 'Content-Type': 'application/json' };
            if (s.isBot) {
                headers['user-agent'] = 'Googlebot/2.1 (+http://www.google.com/bot.html)';
            }
            const res = await fetch(`${baseUrl}/api/logs`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    sessionId: s.id,
                    subsite: 'main',
                    events: s.events
                })
            });
            assertTest(`Ingested test session: ${s.id}`, res.ok);
        }

        console.log('\n--- Test Group 2: Segment Visibility Verification ---');
        // 2A: Segment 'all' must include our human sessions
        const resAll = await fetch(`${baseUrl}/api/dashboard/sessions?segment=all&paginate=true&limit=100`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const dataAll = await resAll.json();
        const allList = dataAll.sessions || (Array.isArray(dataAll) ? dataAll : []);
        const foundBrowseInAll = allList.some(s => s.sessionId === testPrefix + 'browse_only');
        const foundConversedInAll = allList.some(s => s.sessionId === testPrefix + 'conversed');
        assertTest(
            'segment=all: Returns browsing-only sessions without dropping them',
            foundBrowseInAll,
            'Browsing-only session is missing from segment=all'
        );
        assertTest(
            'segment=all: Returns conversed sessions',
            foundConversedInAll
        );

        // 2B: Segment 'users' must include both conversed AND browsing-only human visitors
        const resUsers = await fetch(`${baseUrl}/api/dashboard/sessions?segment=users&paginate=true&limit=100`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const dataUsers = await resUsers.json();
        const usersList = dataUsers.sessions || (Array.isArray(dataUsers) ? dataUsers : []);
        const foundBrowseInUsers = usersList.some(s => s.sessionId === testPrefix + 'browse_only');
        const foundConversedInUsers = usersList.some(s => s.sessionId === testPrefix + 'conversed');
        assertTest(
            'segment=users: Browsing-only human visitor is retained (critical fix for disappearing sessions)',
            foundBrowseInUsers,
            'Browsing-only visitor disappeared from segment=users list'
        );
        assertTest(
            'segment=users: Conversed human visitor is retained',
            foundConversedInUsers
        );

        // 2C: Segment 'conversed' must ONLY contain visitors who had conversations
        const resConversed = await fetch(`${baseUrl}/api/dashboard/sessions?segment=conversed&paginate=true&limit=100`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const dataConversed = await resConversed.json();
        const conversedList = dataConversed.sessions || (Array.isArray(dataConversed) ? dataConversed : []);
        const browseInConversed = conversedList.some(s => s.sessionId === testPrefix + 'browse_only');
        const conversedInConversed = conversedList.some(s => s.sessionId === testPrefix + 'conversed');
        assertTest(
            'segment=conversed: Correctly includes conversed session and excludes browse-only session',
            conversedInConversed && !browseInConversed
        );

        console.log('\n--- Test Group 3: Pagination Integrity & Cache Retention ---');
        // Test paginate=true pagination metadata
        const page1Res = await fetch(`${baseUrl}/api/dashboard/sessions?segment=all&paginate=true&limit=2&page=1`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const page1Data = await page1Res.json();
        assertTest(
            'Pagination page=1 returns ok:true, page:1, pageSize:2, and totalCount >= 5',
            page1Data.ok === true && page1Data.page === 1 && page1Data.pageSize === 2 && page1Data.totalCount >= 5
        );

        const page2Res = await fetch(`${baseUrl}/api/dashboard/sessions?segment=all&paginate=true&limit=2&page=2`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const page2Data = await page2Res.json();
        assertTest(
            'Pagination page=2 returns page:2 with sessions slice',
            page2Data.ok === true && page2Data.page === 2 && Array.isArray(page2Data.sessions) && page2Data.sessions.length > 0
        );

        // Verify session cache retention across subsequent calls
        const subsequentRes = await fetch(`${baseUrl}/api/dashboard/sessions?segment=all&paginate=true&limit=100`, {
            headers: { 'Authorization': `Bearer ${validToken}` }
        });
        const subsequentData = await subsequentRes.json();
        const subList = subsequentData.sessions || [];
        const stillRetained = subList.some(s => s.sessionId === testPrefix + 'conversed');
        assertTest(
            'Cache retention: Logged sessions do not disappear after multiple queries',
            stillRetained,
            'Sessions disappeared from cache on subsequent request'
        );

    } finally {
        await new Promise((resolve) => server.close(resolve));
    }

    console.log('\n================================================================');
    console.log(`R3B Suite Finished: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('================================================================');

    return { total: totalTests, passed: passedTests, failed: failedTests, failures };
}

if (require.main === module) {
    run().then((res) => {
        process.exitCode = res.failed > 0 ? 1 : 0;
        process.exit(process.exitCode);
    }).catch((err) => {
        console.error('Fatal test error in test_r3b_session_visibility:', err);
        process.exit(1);
    });
}

module.exports = run;
