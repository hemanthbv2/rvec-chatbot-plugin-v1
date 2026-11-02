const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Set test environment
process.env.PORT = '3045';
process.env.JWT_SECRET = 'rvce_command_center_secret_2026';
process.env.SUPABASE_URL = 'https://mxujlyyjhjbnnroozbvf.supabase.co';
process.env.SUPABASE_ANON_KEY = 'sb_publishable_D65ZHjD5ofyVQ_3ofsEOxw_Cqj98ssv';

const app = require('./server.js');

function makeRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = data;
                try { parsed = JSON.parse(data); } catch(e) {}
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });
        req.on('error', reject);
        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runAudit() {
    console.log('=====================================================');
    console.log('   RVCE CHATBOT & DASHBOARD SYSTEM CONNECTION AUDIT  ');
    console.log('=====================================================\n');

    const results = [];
    console.log('✅ Local test server running on port ' + process.env.PORT);

    try {
        // 1. Frontend UI Connection
        const uiRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: '/dashboard',
            method: 'GET'
        });
        const uiOk = uiRes.status === 200 && typeof uiRes.body === 'string' && uiRes.body.includes('RVCE');
        results.push({ test: '1. Frontend SPA UI Delivery (GET /dashboard)', status: uiOk ? 'PASS' : 'FAIL', code: uiRes.status });

        // 2. Authentication & JWT Token Issuance
        const loginRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { username: 'rvceadmin', password: 'rvce123' });
        const token = loginRes.body?.token;
        const loginOk = loginRes.status === 200 && !!token;
        results.push({ test: '2. Admin Login & JWT Issuance (POST /api/auth/login)', status: loginOk ? 'PASS' : 'FAIL', code: loginRes.status });

        // 3. Auth Token Middleware Verification
        const authMeRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: '/api/auth/me',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const authMeOk = authMeRes.status === 200 && authMeRes.body?.user?.username === 'rvceadmin';
        results.push({ test: '3. Bearer Token Verification (GET /api/auth/me)', status: authMeOk ? 'PASS' : 'FAIL', code: authMeRes.status });

        // 4. Ingestion Connection: Main Subdomain
        const testSid = 'sess_audit_' + Date.now();
        const ingestMainRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: '/api/logs',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            sessionId: testSid,
            subsite: 'main',
            events: [
                { eventType: 'page_load', pagePath: '/admissions', timestamp: new Date().toISOString() },
                { eventType: 'message', queryText: 'What is KCET cutoff for AIML?', timestamp: new Date().toISOString() }
            ]
        });
        const ingestMainOk = ingestMainRes.status === 200 && ingestMainRes.body?.success === true;
        results.push({ test: '4. Telemetry Ingestion from Main Portal (POST /api/logs)', status: ingestMainOk ? 'PASS' : 'FAIL', code: ingestMainRes.status });

        // 5. Ingestion Connection: Departments Subdomain (Cross-Subsite Hop)
        const ingestDeptRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: '/api/logs',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            sessionId: testSid,
            subsite: 'departments',
            events: [
                {
                    eventType: 'cross_subsite_hop',
                    metaData: { fromSubsite: 'main', toSubsite: 'departments', detail: 'Transitioned from main to departments' }
                },
                { eventType: 'message', queryText: 'Who is HOD of AIML?', timestamp: new Date().toISOString() }
            ]
        });
        const ingestDeptOk = ingestDeptRes.status === 200 && ingestDeptRes.body?.success === true;
        results.push({ test: '5. Cross-Subsite Hop Ingestion (departments.rvce.edu.in)', status: ingestDeptOk ? 'PASS' : 'FAIL', code: ingestDeptRes.status });

        // 6. Ingestion Connection: Library Subdomain
        const ingestLibRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: '/api/logs',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            sessionId: testSid,
            subsite: 'library',
            events: [
                {
                    eventType: 'cross_subsite_hop',
                    metaData: { fromSubsite: 'departments', toSubsite: 'library', detail: 'Transitioned from departments to library' }
                },
                { eventType: 'link_click', linkText: 'Digital Repository', timestamp: new Date().toISOString() }
            ]
        });
        const ingestLibOk = ingestLibRes.status === 200 && ingestLibRes.body?.success === true;
        results.push({ test: '6. Cross-Subsite Hop Ingestion (library.rvce.edu.in)', status: ingestLibOk ? 'PASS' : 'FAIL', code: ingestLibRes.status });

        // 7. Dashboard Overview KPIs Connection
        const overviewRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: '/api/dashboard/overview?segment=all',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const ovOk = overviewRes.status === 200 && overviewRes.body?.totalSessions >= 1;
        results.push({ test: '7. Overview Analytics Metrics (GET /api/dashboard/overview)', status: ovOk ? 'PASS' : 'FAIL', code: overviewRes.status });

        // 8. Sessions Explorer Connection & Multi-Subsite Verification
        const sessionsRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: '/api/dashboard/sessions?limit=50',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const foundSession = Array.isArray(sessionsRes.body) && sessionsRes.body.find(s => s.sessionId === testSid);
        const hasAllSubsites = foundSession && Array.isArray(foundSession.subsitesTouched) && foundSession.subsitesTouched.includes('main') && foundSession.subsitesTouched.includes('departments') && foundSession.subsitesTouched.includes('library');
        results.push({ test: '8. Session Explorer Multi-Subsite Unification', status: hasAllSubsites ? 'PASS' : 'FAIL', code: sessionsRes.status });

        // 9. Single Session Replay Detail Connection
        const sessionDetailRes = await makeRequest({
            hostname: 'localhost',
            port: 3045,
            path: `/api/dashboard/session/${testSid}`,
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const detailOk = sessionDetailRes.status === 200 && sessionDetailRes.body?.journey?.length >= 3 && sessionDetailRes.body?.dialogue?.length >= 2;
        results.push({ test: '9. Single Session Replay & Dialogue Stream (GET /api/dashboard/session/:id)', status: detailOk ? 'PASS' : 'FAIL', code: sessionDetailRes.status });

        // 10. Live Server-Sent Events (SSE) Stream Connection
        const sseOk = await new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 3045,
                path: '/api/dashboard/live/stream',
                method: 'GET',
                headers: { 'Accept': 'text/event-stream' }
            }, (res) => {
                const isStream = res.statusCode === 200 && res.headers['content-type']?.includes('text/event-stream');
                req.destroy();
                resolve(isStream);
            });
            req.on('error', () => resolve(false));
            req.end();
        });
        results.push({ test: '10. Real-time Live Stream Connection (GET /api/dashboard/live/stream)', status: sseOk ? 'PASS' : 'FAIL', code: sseOk ? 200 : 500 });

        // 11. WordPress Plugin ZIP Packaging Check
        const zipPath = path.join(__dirname, '..', 'rvce-chatbot.zip');
        const zipExists = fs.existsSync(zipPath);
        const zipStats = zipExists ? fs.statSync(zipPath) : null;
        const zipOk = zipExists && zipStats.size > 500000;
        results.push({ test: '11. WordPress Plugin ZIP Package Integrity (rvce-chatbot.zip)', status: zipOk ? 'PASS' : 'FAIL', code: zipStats ? `${Math.round(zipStats.size / 1024)} KB` : 'MISSING' });

    } finally {
        // test complete
    }

    console.log('\n--- CONNECTION AUDIT RESULTS MATRIX ---');
    console.table(results);

    const allPassed = results.every(r => r.status === 'PASS');
    if (allPassed) {
        console.log('\n🎉 ALL 11 SYSTEM CONNECTIONS PASSED! SYSTEM IS 100% GOOD TO GO!');
        process.exit(0);
    } else {
        console.error('\n⚠️ Some connections failed. Check table above.');
        process.exit(1);
    }
}

runAudit().catch(err => {
    console.error('Audit fatal error:', err);
    process.exit(1);
});
