const http = require('http');

async function testJourney() {
    const postData = JSON.stringify({
        username: 'rvceadmin',
        password: 'rvce123'
    });

    const loginRes = await new Promise((res, rej) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => res(JSON.parse(d)));
        });
        req.write(postData);
        req.end();
    });

    const token = loginRes.token;

    const sid = 'sess_journey_verify_' + Date.now();
    const startTime = Date.now();

    // 1. Page load
    // 2. Open chat
    // 3. Click suggestion button "Admissions 2026"
    // 4. Send chat message "What is the cutoff for CSE?"
    const logsData = JSON.stringify({
        instituteId: 'rvce',
        sessionId: sid,
        events: [
            { eventType: 'page_load', timestamp: new Date(startTime).toISOString(), pageUrl: 'https://rvce.edu.in/admissions' },
            { eventType: 'bot_open', timestamp: new Date(startTime + 3000).toISOString(), pageUrl: 'https://rvce.edu.in/admissions' },
            { eventType: 'button_click', timestamp: new Date(startTime + 7000).toISOString(), pageUrl: 'https://rvce.edu.in/admissions', data: { buttonText: 'Admissions 2026', elementId: 'adm_btn' } },
            { eventType: 'message', timestamp: new Date(startTime + 15000).toISOString(), pageUrl: 'https://rvce.edu.in/admissions', data: { query: 'What is the cutoff for CSE?', intent: 'cse_cutoff', botReply: 'Top 250 KCET rank.' } }
        ]
    });

    await new Promise((res, rej) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/logs',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => res(JSON.parse(d)));
        });
        req.write(logsData);
        req.end();
    });

    const sessionRes = await new Promise((res, rej) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3001,
            path: '/api/dashboard/session/' + sid,
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        }, r => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => res(JSON.parse(d)));
        });
        req.end();
    });

    console.log('--- REPLAY JOURNEY VERIFICATION OUTPUT ---');
    console.log('Journey step count:', sessionRes.journey?.length);
    sessionRes.journey?.forEach(step => {
        console.log(`Step ${step.step} [${step.type}] (${step.timeOffset}): ${step.title} -> ${step.detail}`);
    });
}

testJourney().catch(console.error);

