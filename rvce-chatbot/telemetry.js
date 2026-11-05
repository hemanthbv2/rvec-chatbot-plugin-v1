/**
 * RVCE Telemetry Engine - High-Performance Dual Write Architecture
 *
 * Lightweight, zero-overhead telemetry for RV College of Engineering (RVCE).
 * Transmits real-time analytics & interaction telemetry to two endpoints:
 *  1. WordPress REST API  -> MySQL DB -> In-Plugin WP Admin Dashboard (/wp-json/rvce/v1/logs)
 *  2. Central Node.js API  -> MongoDB  -> External Multi-Institute Dashboard (/api/logs)
 *
 * Performance Optimized:
 *  - Fully disabled in Elementor / visual page builders
 *  - Zero unthrottled mouseover/scroll event listeners
 *  - Passive click listeners scoped to chatbot UI
 *  - Efficient 15-second queue flushing with lock
 */

(function () {
    // 1. Never run inside Elementor editor or page builders
    if (
        typeof window !== 'undefined' && (
            window.location.search.includes('elementor-preview') ||
            window.location.search.includes('action=elementor') ||
            window.location.search.includes('elementor_library') ||
            window.location.search.includes('fl_builder') ||
            window.location.search.includes('et_fb') ||
            window.location.search.includes('ct_builder') ||
            window.location.search.includes('bricks') ||
            (window.parent !== window && (window.location.search.includes('preview') || document.body?.classList.contains('elementor-editor-active')))
        )
    ) {
        return;
    }

    // Session continuity with 30-minute rolling timeout
    // Cross-Domain & Multi-Subportal Session Engine
    const SESSION_STORAGE_KEY = 'rvce_telemetry_session';
    const SESSION_COOKIE_NAME = 'rvce_sid';
    const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    function getRootDomain() {
        try {
            const host = window.location.hostname;
            if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return '';
            const parts = host.split('.');
            if (parts.length >= 2) {
                const isTwoPartTld = parts.length > 2 && (parts[parts.length - 2] === 'edu' || parts[parts.length - 2] === 'ac' || parts[parts.length - 2] === 'co' || parts[parts.length - 2] === 'gov');
                return '.' + parts.slice(isTwoPartTld ? -3 : -2).join('.');
            }
        } catch (e) {}
        return '';
    }

    function readCookie(name) {
        try {
            const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
            return match ? decodeURIComponent(match[3]) : null;
        } catch (e) {
            return null;
        }
    }

    function writeCookie(name, val, maxAgeSec = 86400) {
        try {
            const rootDomain = getRootDomain();
            const domainPart = rootDomain ? `; domain=${rootDomain}` : '';
            const securePart = window.location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = `${name}=${encodeURIComponent(val)}; path=/${domainPart}; max-age=${maxAgeSec}; SameSite=Lax${securePart}`;
        } catch (e) {}
    }

    function generateSecureSessionId() {
        try {
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return 'sess_rvce_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16) + '_' + Date.now().toString(36);
            }
        } catch (e) {}
        return 'sess_rvce_' + Math.random().toString(36).substr(2, 9) + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
    }

    function syncStorage(sid) {
        if (!sid) return;
        writeCookie(SESSION_COOKIE_NAME, sid);
        try {
            if (typeof window !== 'undefined') {
                window.rvceSessionId = sid;
                if (window.sessionStorage) {
                    window.sessionStorage.setItem('rvce_sid', sid);
                    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: sid, lastActive: Date.now() }));
                }
                if (window.localStorage) {
                    window.localStorage.setItem('rvce_sid', sid);
                }
            }
        } catch (e) {}
    }

    function getOrCreateSessionId() {
        let sid = null;

        // 0. Check global window session already initialized
        if (typeof window !== 'undefined' && window.rvceSessionId && /^(sess_|sid_)[a-zA-Z0-9_-]+$/.test(window.rvceSessionId)) {
            sid = window.rvceSessionId;
            syncStorage(sid);
            return sid;
        }

        // 1. Cross-portal URL query parameter handoff (?rvce_sid=... or ?sid=...)
        try {
            const urlParams = new URLSearchParams(window.location.search);
            sid = urlParams.get('rvce_sid') || urlParams.get('sid');
            if (sid && /^(sess_|sid_)[a-zA-Z0-9_-]+$/.test(sid)) {
                syncStorage(sid);
                // Clean up address bar quietly so URL remains clean
                if (window.history && window.history.replaceState) {
                    urlParams.delete('rvce_sid');
                    urlParams.delete('sid');
                    const cleanQuery = urlParams.toString() ? '?' + urlParams.toString() : '';
                    window.history.replaceState(null, '', window.location.pathname + cleanQuery + window.location.hash);
                }
                return sid;
            }
        } catch (e) {}

        // 2. Shared Root Domain Cookie (.rvce.edu.in)
        const cookieSid = readCookie(SESSION_COOKIE_NAME);
        if (cookieSid && /^(sess_|sid_)[a-zA-Z0-9_-]+$/.test(cookieSid)) {
            sid = cookieSid;
            syncStorage(sid);
            return sid;
        }

        // 3. sessionStorage / localStorage
        try {
            if (typeof window !== 'undefined') {
                if (window.sessionStorage) {
                    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
                    if (raw) {
                        const parsed = JSON.parse(raw);
                        if (parsed && parsed.id && (Date.now() - (parsed.lastActive || 0) < SESSION_TIMEOUT_MS)) {
                            parsed.lastActive = Date.now();
                            sid = parsed.id;
                            syncStorage(sid);
                            return sid;
                        }
                    }
                    const sessSid = window.sessionStorage.getItem('rvce_sid');
                    if (sessSid && /^(sess_|sid_)[a-zA-Z0-9_-]+$/.test(sessSid)) {
                        sid = sessSid;
                        syncStorage(sid);
                        return sid;
                    }
                }
                const localSid = window.localStorage.getItem('rvce_sid');
                if (localSid && /^(sess_|sid_)[a-zA-Z0-9_-]+$/.test(localSid)) {
                    sid = localSid;
                    syncStorage(sid);
                    return sid;
                }
            }
        } catch (e) {}

        // 4. Generate new collision-proof session ID for 1,000+ concurrent visitors
        const newId = generateSecureSessionId();
        syncStorage(newId);
        return newId;
    }

    function touchSession() {
        try {
            syncStorage(SESSION_ID);
        } catch(e) {}
    }

    const SESSION_ID = getOrCreateSessionId();
    if (typeof window !== 'undefined') {
        window.rvceSessionId = SESSION_ID;
    }
    const PAGE_LOAD_TIME = Date.now();
    let telemetryQueue = [];
    let isFlushing = false;
    let lastTrackedEventKey = '';
    let lastTrackedEventTime = 0;

    // Helper to retrieve WordPress localized endpoints
    function getEndpoints() {
        const wpRestUrl = (window.rvceChatbotSettings && window.rvceChatbotSettings.restUrl)
            ? window.rvceChatbotSettings.restUrl.replace(/\/$/, '')
            : '';
        let vercelUrl = (window.rvceChatbotSettings && window.rvceChatbotSettings.vercelUrl)
            ? String(window.rvceChatbotSettings.vercelUrl).trim()
            : (typeof window !== 'undefined' && window.RVCE_TELEMETRY_URL ? String(window.RVCE_TELEMETRY_URL).trim() : '');
        if (vercelUrl) {
            vercelUrl = vercelUrl.replace(/\/(dashboard|api)\/?$/, '').replace(/\/+$/, '');
            if (vercelUrl.includes('.vercel.app') && vercelUrl.startsWith('http://')) {
                vercelUrl = 'https://' + vercelUrl.substring(7);
            }
        }
        return { wpRestUrl, vercelUrl };
    }

    // Helper to determine active sub-portal (Main, Departments, Alumni/Library)
    function getSubsite() {
        const configured = (window.rvceChatbotSettings && window.rvceChatbotSettings.subsite)
            ? String(window.rvceChatbotSettings.subsite).toLowerCase().trim()
            : 'auto';
        if (configured && configured !== 'auto') {
            return configured;
        }
        // Automatic URL pattern classification
        const path = (window.location.pathname || '').toLowerCase();
        const host = (window.location.hostname || '').toLowerCase();
        const href = (window.location.href || '').toLowerCase();
        if (path.includes('/department') || path.includes('/dept') || host.includes('dept') || href.includes('/department/')) {
            return 'departments';
        }
        if (path.includes('/alumni') || path.includes('/library') || host.includes('alumni') || host.includes('library') || href.includes('/alumni') || href.includes('/library')) {
            return 'alumni';
        }
        return 'main';
    }

    // Core event tracking dispatcher with 800ms debounce idempotency
    function trackEvent(eventType, eventData = {}, immediate = false) {
        // Client-side debounce on duplicate events fired in rapid succession
        const eventText = String(eventData.buttonText || eventData.linkText || eventData.query || eventData.elementId || '').toLowerCase().trim();
        const eventKey = `${eventType}:${eventText}`;
        const now = Date.now();
        if (eventText && eventKey === lastTrackedEventKey && (now - lastTrackedEventTime < 800)) {
            return;
        }
        if (eventText) {
            lastTrackedEventKey = eventKey;
            lastTrackedEventTime = now;
        }

        const subsite = getSubsite();
        const logEntry = {
            sessionId: SESSION_ID,
            timestamp: new Date().toISOString(),
            eventType: eventType,
            url: window.location.href,
            subsite: subsite,
            data: { ...eventData, subsite: subsite }
        };
        telemetryQueue.push(logEntry);

        if (window.rvceChatbotDebug) {
            console.log(`[RVCE Telemetry] [${subsite}] ${eventType}`, logEntry);
        }

        // High-priority events flush immediately to ensure real-time analytics
        if (immediate || eventType === 'message' || eventType === 'form_submit' || eventType === 'page_load') {
            flushQueue();
        }
    }

    // Expose globally for Chatbot Engine (script.js)
    window.rvceTrackEvent = trackEvent;
    window.rvceGetSubsite = getSubsite;

    // Global Helper to explicitly track Chatbot Openings with exact page context
    window.rvceTrackBotOpen = function() {
        const urlParams = new URLSearchParams(window.location.search);
        const utm = {};
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
            const v = urlParams.get(k);
            if (v) utm[k] = v;
        });

        trackEvent('bot_open', {
            pagePath: window.location.pathname || '/',
            url: window.location.href,
            title: document.title,
            referrer: document.referrer || 'direct',
            utm: Object.keys(utm).length ? utm : undefined
        }, true);
    };

    // Track Button, Link & Chip Clicks inside Chatbot
    document.addEventListener('click', (e) => {
        if (e._rvceClickTracked) return;
        const target = e.target;
        if (!target) return;
        const btn = target.closest('button') || target.closest('a') || target.closest('.suggestion-chip') || target.closest('.chip');
        if (!btn) return;

        // Track clicks inside the chatbot or explicit tracking attributes
        const isChatbot = btn.closest('#rvce-chatbot-root') !== null || btn.closest('#rvce-chat-modal') !== null;
        const isTracked = btn.hasAttribute('data-rvce-track') || btn.classList.contains('suggestion-chip') || btn.classList.contains('chip');

        if (isChatbot || isTracked) {
            e._rvceClickTracked = true;
            const isLink = btn.tagName.toLowerCase() === 'a' || btn.hasAttribute('href');
            const linkUrl = btn.href || btn.getAttribute('href') || '';
            const elementId = btn.id || btn.getAttribute('data-query') || btn.getAttribute('data-action') || btn.className || 'action_button';
            const elementText = (btn.innerText || btn.textContent || '').substring(0, 60).trim();

            if (isLink && linkUrl && !linkUrl.startsWith('javascript:') && !linkUrl.startsWith('#')) {
                const isExt = linkUrl.startsWith('http') && !linkUrl.includes('rvce.edu.in');
                trackEvent('link_click', {
                    linkUrl: linkUrl,
                    targetUrl: linkUrl,
                    linkText: elementText || linkUrl,
                    isExternal: isExt,
                    location: isChatbot ? 'Chatbot' : 'Webpage'
                }, true);
            } else {
                trackEvent('button_click', {
                    elementId: elementId,
                    buttonText: elementText,
                    location: isChatbot ? 'Chatbot' : 'Webpage'
                }, true);
            }
        }
    }, { passive: true });

    // Track Copied Text from chatbot
    document.addEventListener('copy', () => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const node = sel.anchorNode;
        if (node && node.parentElement && node.parentElement.closest('#rvce-chatbot-root')) {
            const text = sel.toString();
            if (text) {
                trackEvent('copy', { length: text.length, snippet: text.substring(0, 60) });
            }
        }
    }, { passive: true });

    // Dual-Write Transmission with deduplication and reliable fallback
    
    // -------------------------------------------------------------------------
    // Friction Detection Engine: Rage Clicks, Dead Clicks & Typing Hesitation
    // -------------------------------------------------------------------------
    let clickHistory = [];
    document.addEventListener('click', (e) => {
        const root = document.getElementById('rvce-chatbot-root') || document.querySelector('.app-container');
        if (!root || !root.contains(e.target)) return;

        const now = Date.now();
        clickHistory.push({ x: e.clientX, y: e.clientY, time: now, target: e.target });
        clickHistory = clickHistory.filter(c => now - c.time < 800);

        // 1. Rage Click Detection (3+ rapid clicks in < 800ms)
        if (clickHistory.length >= 3) {
            const targetText = (e.target.innerText || e.target.textContent || '').substring(0, 35).trim();
            const tag = e.target.tagName.toLowerCase();
            trackEvent('rage_click', {
                element: tag,
                elementText: targetText,
                clicksCount: clickHistory.length,
                url: window.location.href
            }, true);
            clickHistory = [];
            return;
        }

        // 2. Dead Click Detection (clicks on static bot message text expecting links/action)
        const isInteractive = e.target.closest('button, a, input, select, textarea, [role="button"], .suggestion-chip, .emoji-btn, .mic-btn');
        if (!isInteractive && (e.target.classList.contains('chat-bubble') || e.target.closest('.chat-bubble'))) {
            const staticText = (e.target.innerText || e.target.textContent || '').substring(0, 45).trim();
            trackEvent('dead_click', {
                element: e.target.tagName.toLowerCase(),
                elementText: staticText,
                url: window.location.href
            });
        }
    }, { passive: true });

    // 3. Typing Hesitation Detection (pause > 3.5s with text entered in #userInput)
    let typingTimer = null;
    let typingStart = 0;
    document.addEventListener('input', (e) => {
        if (e.target && (e.target.id === 'userInput' || e.target.classList.contains('chat-input'))) {
            if (!typingStart) typingStart = Date.now();
            clearTimeout(typingTimer);
            typingTimer = setTimeout(() => {
                if (e.target.value && e.target.value.trim().length >= 3) {
                    trackEvent('typing_hesitation', {
                        draftLength: e.target.value.trim().length,
                        dwellMs: Date.now() - typingStart,
                        url: window.location.href
                    });
                }
                typingStart = 0;
            }, 3500);
        }
    }, { passive: true });

    async function sendBatch(batch) {
        if (!batch || batch.length === 0) return;
        touchSession();
        const { wpRestUrl, vercelUrl } = getEndpoints();
        const subsite = getSubsite();

        const botOpenItem = batch.find(b => b.eventType === 'bot_open' || b.eventType === 'chat_open');
        const triggerPage = botOpenItem?.data?.pagePath || (window.location.pathname || '/');
        const urlParams = new URLSearchParams(window.location.search);
        const utm = {};
        ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'].forEach(k => {
            const v = urlParams.get(k);
            if (v) utm[k] = v;
        });

        const payload = JSON.stringify({
            institute_id: 'rvce',
            instituteId: 'rvce',
            subsite: subsite,
            site_category: subsite,
            api_key: 'rvce_key_12345',
            apiKey: 'rvce_key_12345',
            sessionId: SESSION_ID,
            landingPage: window.location.pathname || '/',
            entryPage: window.location.pathname || '/',
            botOpenedOnPage: triggerPage,
            referrer: document.referrer || 'direct',
            utm: Object.keys(utm).length ? utm : undefined,
            metaData: {
                landingPage: window.location.pathname || '/',
                entryPage: window.location.pathname || '/',
                botOpenedOnPage: triggerPage,
                referrer: document.referrer || 'direct',
                utm: Object.keys(utm).length ? utm : undefined
            },
            events: batch
        });

        const requests = [];

        // 1. WordPress REST API (Local WP MySQL database)
        if (wpRestUrl) {
            requests.push(
                fetch(wpRestUrl + '/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                })
                .then(r => { if (!r.ok) throw new Error('WP status ' + r.status); })
                .catch(() => { /* silent graceful failover */ })
            );
        }

        // 2. Central Backend API (Node.js Express / Vercel -> Dual writes to Supabase)
        let centralBase = vercelUrl;
        if (!centralBase && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            centralBase = 'http://localhost:3001';
        }

        let centralSuccess = false;
        if (centralBase) {
            try {
                const resp = await fetch(centralBase.replace(/\/+$/, '') + '/api/logs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: payload
                });
                if (resp.ok) {
                    centralSuccess = true;
                }
            } catch (err) {
                centralSuccess = false;
            }
        }

        // 3. Fallback Direct Supabase Ingestion
        // Runs ONLY if central backend is unavailable, preventing duplicate writes in Supabase
        if (!centralSuccess) {
            try {
                const SUPABASE_REST_URL = 'https://mxujlyyjhjbnnroozbvf.supabase.co/rest/v1';
                const SUPABASE_KEY = 'sb_publishable_D65ZHjD5ofyVQ_3ofsEOxw_Cqj98ssv';
                const supaHeaders = {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_KEY,
                    'Authorization': 'Bearer ' + SUPABASE_KEY,
                    'Prefer': 'return=minimal'
                };

                const supaInteractions = batch.map(b => ({
                    session_id: SESSION_ID,
                    institute_id: 'rvce',
                    event_type: b.eventType || 'message',
                    interaction_id: b.data?.intent || b.data?.elementId || b.eventType || '',
                    query_text: b.data?.query || b.data?.elementText || '',
                    bot_reply: b.data?.botReply || '',
                    page_url: b.url || window.location.href,
                    page_path: window.location.pathname || '/',
                    element: { id: b.data?.elementId || '', text: b.data?.elementText || '' },
                    metadata: b.data || {},
                    created_at: b.timestamp || new Date().toISOString()
                }));

                const botOpenBatchItem = batch.find(b => b.eventType === 'bot_open' || b.eventType === 'chat_open');
                const botOpenedOnPage = botOpenBatchItem ? (botOpenBatchItem.data?.pagePath || window.location.pathname || '/') : '';

                await Promise.allSettled([
                    fetch(SUPABASE_REST_URL + '/interactions', {
                        method: 'POST',
                        headers: supaHeaders,
                        body: JSON.stringify(supaInteractions)
                    }),
                    fetch(SUPABASE_REST_URL + '/sessions', {
                        method: 'POST',
                        headers: { ...supaHeaders, 'Prefer': 'resolution=merge-duplicates' },
                        body: JSON.stringify({
                            session_id: SESSION_ID,
                            institute_id: 'rvce',
                            landing_page: window.location.pathname || '/',
                            last_active: new Date().toISOString(),
                            metrics: {
                                event_count: batch.length,
                                ...(botOpenedOnPage ? { bot_opened_on_page: botOpenedOnPage } : {})
                            }
                        })
                    })
                ]);
            } catch (supaErr) {
                /* silent failover */
            }
        }

        try {
            await Promise.allSettled(requests);
        } catch(e) {}
    }

    async function flushQueue() {
        if (isFlushing || telemetryQueue.length === 0) return;
        isFlushing = true;
        const batch = [...telemetryQueue];
        telemetryQueue = [];
        try {
            await sendBatch(batch);
        } finally {
            isFlushing = false;
        }
    }

    // Flush batch every 15 seconds
    setInterval(flushQueue, 15000);

    // Final flush on window beforeunload with application/json Blob to prevent drops
    window.addEventListener('beforeunload', () => {
        if (telemetryQueue.length === 0) return;
        const batch = [...telemetryQueue];
        telemetryQueue = [];
        const { vercelUrl } = getEndpoints();
        const subsite = getSubsite();
        let centralBase = vercelUrl;
        if (!centralBase && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
            centralBase = 'http://localhost:3001';
        }
        const payload = JSON.stringify({
            institute_id: 'rvce',
            instituteId: 'rvce',
            subsite: subsite,
            site_category: subsite,
            api_key: 'rvce_key_12345',
            sessionId: SESSION_ID,
            events: batch
        });
        if (navigator.sendBeacon && centralBase) {
            try {
                const blob = new Blob([payload], { type: 'application/json' });
                navigator.sendBeacon(centralBase.replace(/\/+$/, '') + '/api/logs', blob);
            } catch (beaconErr) {
                navigator.sendBeacon(centralBase.replace(/\/+$/, '') + '/api/logs', payload);
            }
        }
    });

    // Register initial page load and flush immediately for sub-second session tracking
    trackEvent('page_load', {
        title: document.title,
        referrer: document.referrer || 'direct',
        screen: `${window.innerWidth}x${window.innerHeight}`,
        subsite: getSubsite()
    }, true);

    // Expose Session ID globally for Chatbot Engine
    window.rvceSessionId = SESSION_ID;
    window.rvceGetSessionId = function() { return SESSION_ID; };

    // Standardized RVCETelemetry API Interface (Supports Simulator, Micro-interactions & Test Suites)
    window.RVCETelemetry = {
        getSessionId: () => SESSION_ID,
        trackEvent: trackEvent,
        trackBotOpen: window.rvceTrackBotOpen,
        trackBotClose: function() {
            trackEvent('bot_close', { pagePath: window.location.pathname || '/' }, true);
        },
        trackMessage: function(query, intent, botReply) {
            trackEvent('message', { query: query, intent: intent, botReply: botReply }, true);
        },
        trackHesitation: function(draft) {
            trackEvent('typing_hesitation', { draftText: draft, detail: 'Erased question draft' }, true);
        },
        trackBotFallback: function(query, reply) {
            trackEvent('bot_fallback', { queryText: query, botReply: reply, isUnanswered: true }, true);
        },
        trackInteraction: function(type, label, meta = {}) {
            trackEvent(type, { elementId: label, elementText: label, ...meta }, true);
        },
        trackSimulateBot: function(botName, botCategory) {
            trackEvent('bot_probe', {
                isBot: true,
                botName: botName,
                botCategory: botCategory,
                detail: `Automated crawler simulation: ${botName}`
            }, true);
        }
    };

    // Automatic Cross-Portal Link Decoration for seamless session handoff
    function decorateRvceUrl(rawUrl) {
        if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
        try {
            const targetUrl = new URL(rawUrl, window.location.href);
            const isRvceDomain = targetUrl.hostname.endsWith('rvce.edu.in') || targetUrl.hostname === 'rvce.edu.in' || targetUrl.hostname.includes('localhost') || targetUrl.hostname.includes('127.0.0.1');
            if (isRvceDomain && !targetUrl.searchParams.has('rvce_sid')) {
                targetUrl.searchParams.set('rvce_sid', SESSION_ID);
                return targetUrl.toString();
            }
        } catch(e) {}
        return rawUrl;
    }
    window.rvceDecorateUrl = decorateRvceUrl;

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link || !link.href) return;
        try {
            link.href = decorateRvceUrl(link.href);
        } catch (linkErr) {}
    }, true);

    // Track Cross-Subsite Navigation Transition
    try {
        const currentSub = getSubsite();
        const prevSub = (typeof sessionStorage !== 'undefined') ? sessionStorage.getItem('rvce_current_subsite') : null;
        if (prevSub && prevSub !== currentSub) {
            trackEvent('cross_subsite_hop', {
                fromSubsite: prevSub,
                toSubsite: currentSub,
                referrer: document.referrer || '',
                detail: 'Visitor navigated from ' + prevSub + ' portal to ' + currentSub + ' portal'
            }, true);
        }
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('rvce_current_subsite', currentSub);
        }
    } catch (hopErr) {}

})();
