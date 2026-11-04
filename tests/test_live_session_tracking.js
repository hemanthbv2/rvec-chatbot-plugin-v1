/**
 * Live Session Tracking & Dashboard Integrity Verification
 * Comprehensive End-to-End Suite for RVCE Chatbot & Command Center
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, data: parsed });
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

const tests = [];
let passedCount = 0;
let failedCount = 0;

function it(name, fn) {
    tests.push({ name, fn });
}

async function run() {
    console.log('===============================================================');
    console.log('   RVCE LIVE SESSION TRACKING & DASHBOARD VERIFICATION SUITE   ');
    console.log('===============================================================\n');

    let adminToken = '';

    it('1. Admin Authentication & JWT Token Issuance', async () => {
        const res = await request('POST', '/api/auth/login', {
            username: 'rvceadmin',
            password: 'rvce123'
        });
        if (res.status !== 200 || !res.data.token) {
            throw new Error(`Login failed with status ${res.status}: ${JSON.stringify(res.data)}`);
        }
        adminToken = res.data.token;
    });

    it('2. Track Browsed-Only Session (No Bot Open)', async () => {
        const sessionId = 'sess_test_browse_' + Date.now();
        const res = await request('POST', '/api/logs', {
            instituteId: 'rvce',
            sessionId: sessionId,
            subsite: 'main',
            events: [
                {
                    eventType: 'page_load',
                    timestamp: new Date().toISOString(),
                    pageUrl: 'https://rvce.edu.in/admissions',
                    pageTitle: 'Admissions 2026',
                    referrer: 'https://google.com'
                },
                {
                    eventType: 'link_click',
                    timestamp: new Date(Date.now() + 5000).toISOString(),
                    pageUrl: 'https://rvce.edu.in/admissions',
                    targetUrl: 'https://rvce.edu.in/fees',
                    text: 'View Fee Structure'
                }
            ]
        });

        if (res.status !== 200 || !res.data.success) {
            throw new Error(`Failed to ingest browsed session: ${JSON.stringify(res.data)}`);
        }

        // Verify session retrieval
        const sessionRes = await request('GET', `/api/dashboard/session/${sessionId}`, null, {
            'Authorization': `Bearer ${adminToken}`
        });

        if (sessionRes.status !== 200 || !sessionRes.data.session) {
            throw new Error(`Failed to retrieve session: ${JSON.stringify(sessionRes.data)}`);
        }

        const s = sessionRes.data.session;
        if (s.chatEngagement !== 'browsed_only') {
            throw new Error(`Expected chatEngagement 'browsed_only', got '${s.chatEngagement}'`);
        }
        if (s.botOpenedOnPage) {
            throw new Error(`Expected botOpenedOnPage to be undefined/null for browsed-only, got '${s.botOpenedOnPage}'`);
        }
        if (s.lastQuery && s.lastQuery !== '') {
            throw new Error(`Expected no lastQuery for browsed-only session, got '${s.lastQuery}'`);
        }
    });

    it('3. Track Bounced Session (Bot Opened But No Dialogue)', async () => {
        const sessionId = 'sess_test_bounce_' + Date.now();
        const res = await request('POST', '/api/logs', {
            instituteId: 'rvce',
            sessionId: sessionId,
            subsite: 'main',
            events: [
                {
                    eventType: 'page_load',
                    timestamp: new Date().toISOString(),
                    pageUrl: 'https://rvce.edu.in/departments/cse',
                    pageTitle: 'Computer Science Department',
                    referrer: 'Direct'
                },
                {
                    eventType: 'bot_open',
                    timestamp: new Date(Date.now() + 3000).toISOString(),
                    pageUrl: 'https://rvce.edu.in/departments/cse'
                }
            ]
        });

        if (res.status !== 200) {
            throw new Error(`Ingest failed: ${res.status}`);
        }

        const sessionRes = await request('GET', `/api/dashboard/session/${sessionId}`, null, {
            'Authorization': `Bearer ${adminToken}`
        });

        const s = sessionRes.data.session;
        if (s.chatEngagement !== 'opened_only') {
            throw new Error(`Expected chatEngagement 'opened_only', got '${s.chatEngagement}'`);
        }
        if (!s.botOpenedOnPage || !s.botOpenedOnPage.includes('/departments/cse')) {
            throw new Error(`Expected botOpenedOnPage to include '/departments/cse', got '${s.botOpenedOnPage}'`);
        }
    });

    it('4. Track Conversed Session with Intent, Query & Bot Reply', async () => {
        const sessionId = 'sess_test_conversed_' + Date.now();
        const query = 'What is the cutoff rank for Computer Science?';
        const intent = 'cse_cutoff';
        const botReply = 'The KCET cutoff for RVCE Computer Science is typically within the top 250 ranks.';

        const res = await request('POST', '/api/logs', {
            instituteId: 'rvce',
            sessionId: sessionId,
            subsite: 'main',
            events: [
                {
                    eventType: 'page_load',
                    timestamp: new Date().toISOString(),
                    pageUrl: 'https://rvce.edu.in/placements',
                    pageTitle: 'RVCE Placements',
                    referrer: 'https://linkedin.com'
                },
                {
                    eventType: 'bot_open',
                    timestamp: new Date(Date.now() + 2000).toISOString(),
                    pageUrl: 'https://rvce.edu.in/placements'
                },
                {
                    eventType: 'message',
                    timestamp: new Date(Date.now() + 4000).toISOString(),
                    pageUrl: 'https://rvce.edu.in/placements',
                    data: {
                        query: query,
                        intent: intent,
                        botReply: botReply
                    }
                }
            ]
        });

        if (res.status !== 200) {
            throw new Error(`Ingest failed: ${res.status}`);
        }

        const sessionRes = await request('GET', `/api/dashboard/session/${sessionId}`, null, {
            'Authorization': `Bearer ${adminToken}`
        });

        const s = sessionRes.data.session;
        const dialogue = sessionRes.data.dialogue;

        if (s.chatEngagement !== 'conversed') {
            throw new Error(`Expected chatEngagement 'conversed', got '${s.chatEngagement}'`);
        }
        if (s.lastQuery !== query) {
            throw new Error(`Expected lastQuery '${query}', got '${s.lastQuery}'`);
        }
        if (!dialogue || dialogue.length < 2) {
            throw new Error(`Expected dialogue to contain at least 2 messages, got ${dialogue?.length}`);
        }

        const userMsg = dialogue.find(d => d.sender === 'user');
        const botMsg = dialogue.find(d => d.sender === 'bot');

        if (!userMsg || userMsg.text !== query) {
            throw new Error(`Expected user dialogue text '${query}', got '${userMsg?.text}'`);
        }
        if (!botMsg || botMsg.text !== botReply) {
            throw new Error(`Expected bot dialogue text '${botReply}', got '${botMsg?.text}'`);
        }
    });

    it('5. Track Unanswered Query & Flagging', async () => {
        const sessionId = 'sess_test_unanswered_' + Date.now();
        const trickyQuery = 'Can I pay fees with cryptocurrency?';

        const res = await request('POST', '/api/logs', {
            instituteId: 'rvce',
            sessionId: sessionId,
            subsite: 'main',
            events: [
                {
                    eventType: 'page_load',
                    timestamp: new Date().toISOString(),
                    pageUrl: 'https://rvce.edu.in/',
                    pageTitle: 'RV College of Engineering'
                },
                {
                    eventType: 'bot_open',
                    timestamp: new Date(Date.now() + 1000).toISOString(),
                    pageUrl: 'https://rvce.edu.in/'
                },
                {
                    eventType: 'message',
                    timestamp: new Date(Date.now() + 2000).toISOString(),
                    pageUrl: 'https://rvce.edu.in/',
                    data: {
                        query: trickyQuery,
                        intent: 'unmatched',
                        botReply: "I'm sorry, I don't have information on that topic.",
                        isUnanswered: true
                    }
                }
            ]
        });

        if (res.status !== 200) {
            throw new Error(`Ingest failed: ${res.status}`);
        }

        // Verify it appears in unanswered dashboard endpoint
        const unansRes = await request('GET', '/api/dashboard/unanswered', null, {
            'Authorization': `Bearer ${adminToken}`
        });

        if (unansRes.status !== 200) {
            throw new Error(`Failed to fetch unanswered queries: ${unansRes.status}`);
        }

        const unansList = Array.isArray(unansRes.data) ? unansRes.data : (unansRes.data.queries || []);
        const found = unansList.find(q => q.queryText === trickyQuery || q.query === trickyQuery);
        if (!found) {
            throw new Error(`Expected query '${trickyQuery}' in unanswered queries list`);
        }
    });

    it('6. Sessions Explorer Segment Filtering (all / conversed / bounced / browsed)', async () => {
        const segments = ['all', 'conversed', 'bounced', 'browsed'];
        for (const seg of segments) {
            const res = await request('GET', `/api/dashboard/sessions?segment=${seg}&limit=10`, null, {
                'Authorization': `Bearer ${adminToken}`
            });
            if (res.status !== 200) {
                throw new Error(`Segment '${seg}' returned status ${res.status}`);
            }
            const sessList = Array.isArray(res.data) ? res.data : res.data.sessions;
            if (!Array.isArray(sessList)) {
                throw new Error(`Segment '${seg}' did not return an array of sessions`);
            }
        }
    });

    it('7. Single Session Deletion Cascade', async () => {
        const sessionId = 'sess_delete_test_' + Date.now();
        await request('POST', '/api/logs', {
            instituteId: 'rvce',
            sessionId: sessionId,
            subsite: 'main',
            events: [
                {
                    eventType: 'page_load',
                    timestamp: new Date().toISOString(),
                    pageUrl: 'https://rvce.edu.in/'
                }
            ]
        });

        const deleteRes = await request('DELETE', `/api/dashboard/sessions/${sessionId}`, null, {
            'Authorization': `Bearer ${adminToken}`
        });

        if (deleteRes.status !== 200 || (!deleteRes.data.success && !deleteRes.data.ok)) {
            throw new Error(`Failed to delete session: ${JSON.stringify(deleteRes.data)}`);
        }

        const verifyRes = await request('GET', `/api/dashboard/session/${sessionId}`, null, {
            'Authorization': `Bearer ${adminToken}`
        });

        if (verifyRes.data.session) {
            throw new Error(`Session ${sessionId} was still found after deletion!`);
        }
    });

    it('8. Supabase Connection Status Verification', async () => {
        const res = await request('GET', '/api/supabase/status', null, {
            'Authorization': `Bearer ${adminToken}`
        });
        if (res.status !== 200 || !res.data.configured) {
            throw new Error(`Supabase status check failed: ${JSON.stringify(res.data)}`);
        }
    });

    for (const t of tests) {
        try {
            await t.fn();
            passedCount++;
            console.log(`[PASS] ${t.name}`);
        } catch (err) {
            failedCount++;
            console.error(`[FAIL] ${t.name}: ${err.message}`);
        }
    }

    console.log('\n===============================================================');
    console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED out of ${tests.length}`);
    console.log('===============================================================');

    if (failedCount > 0) {
        process.exit(1);
    } else {
        console.log('🎉 ALL SESSION TRACKING & DASHBOARD TESTS PASSED SUCCESSFULLY!');
        process.exit(0);
    }
}

run().catch(e => {
    console.error('Fatal error during test run:', e);
    process.exit(1);
});
