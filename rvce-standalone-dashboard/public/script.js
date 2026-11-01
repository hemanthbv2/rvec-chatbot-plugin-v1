/* =========================================================
   RVCE Admin Dashboard — Live Supabase Powered Engine
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // 0. Supabase Credentials & Client Initialization
    const SUPABASE_URL = 'https://mxujlyyjhjbnnroozbvf.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_D65ZHjD5ofyVQ_3ofsEOxw_Cqj98ssv';

    let supa = null;
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }

    // Dynamic Live Data Store
    let LIVE_CONVERSATION_LOGS = [];
    let trafficChart = null;
    let categoryChart = null;

    // UI Elements
    const sidebar = document.getElementById('sidebar');
    const menuToggle = document.getElementById('menu-toggle');
    const closeSidebar = document.getElementById('close-sidebar');
    const navItems = document.querySelectorAll('.nav-item');
    const tabContents = document.querySelectorAll('.tab-content');
    const pageTitle = document.getElementById('page-title');
    const toast = document.getElementById('toast');
    const btnRefresh = document.getElementById('btn-refresh');
    const statusDot = document.getElementById('nlp-status-dot');
    const statusText = document.getElementById('nlp-status-text');

    // 1. Toast Notification Helper
    function showToast(message = 'Updated successfully!') {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // 2. Sidebar & Tab Navigation
    const toggleSidebar = () => sidebar && sidebar.classList.toggle('open');
    if (menuToggle) menuToggle.addEventListener('click', toggleSidebar);
    if (closeSidebar) closeSidebar.addEventListener('click', toggleSidebar);

    const tabTitles = {
        overview: 'Dashboard Overview',
        conversations: 'Conversations Log',
        settings: 'Bot Configuration'
    };

    function switchTab(targetTab) {
        navItems.forEach(item => {
            if (item.dataset.tab === targetTab) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });

        tabContents.forEach(tab => {
            if (tab.id === `tab-${targetTab}`) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        if (pageTitle && tabTitles[targetTab]) {
            pageTitle.textContent = tabTitles[targetTab];
        }

        if (window.innerWidth <= 768 && sidebar) {
            sidebar.classList.remove('open');
        }
    }

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(item.dataset.tab);
        });
    });

    document.querySelectorAll('[data-switch-tab]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(btn.dataset.switchTab);
        });
    });

    // 3. Helper: Time Ago Formatter
    function timeAgo(dateString) {
        if (!dateString) return 'Just now';
        const now = new Date();
        const past = new Date(dateString);
        const diffSeconds = Math.max(0, Math.floor((now - past) / 1000));

        if (diffSeconds < 60) return `${diffSeconds}s ago`;
        const diffMins = Math.floor(diffSeconds / 60);
        if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    // 4. Chart.js Graphs Initialization & Update
    function initCharts(trafficData = [0, 0, 0, 0, 0, 0, 0], categoryCounts = {}) {
        const trafficCtx = document.getElementById('trafficChart')?.getContext('2d');
        const categoryCtx = document.getElementById('categoryChart')?.getContext('2d');

        if (trafficCtx) {
            const gradient = trafficCtx.createLinearGradient(0, 0, 0, 260);
            gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
            gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

            if (trafficChart) trafficChart.destroy();
            trafficChart = new Chart(trafficCtx, {
                type: 'line',
                data: {
                    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                    datasets: [{
                        label: 'Chat Volume',
                        data: trafficData,
                        borderColor: '#6366f1',
                        borderWidth: 3,
                        backgroundColor: gradient,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#6366f1',
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                        y: { beginAtZero: true, grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8', precision: 0 } }
                    }
                }
            });
        }

        if (categoryCtx) {
            const labels = Object.keys(categoryCounts).length > 0 
                ? Object.keys(categoryCounts).slice(0, 5) 
                : ['Placements', 'Admissions', 'Faculty', 'Hostel', 'General'];
            const dataVals = Object.keys(categoryCounts).length > 0 
                ? Object.values(categoryCounts).slice(0, 5) 
                : [0, 0, 0, 0, 0];

            if (categoryChart) categoryChart.destroy();
            categoryChart = new Chart(categoryCtx, {
                type: 'doughnut',
                data: {
                    labels: labels,
                    datasets: [{
                        data: dataVals.every(v => v === 0) ? [1, 1, 1, 1, 1] : dataVals,
                        backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#64748b'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: '#94a3b8', boxWidth: 12, font: { size: 11 } }
                        }
                    },
                    cutout: '70%'
                }
            } );
        }
    }

    // 5. Render Tables (Overview + Full Logs)
    function renderOverviewTable() {
        const body = document.getElementById('overview-table-body');
        if (!body) return;

        if (LIVE_CONVERSATION_LOGS.length === 0) {
            body.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94a3b8; padding: 24px;">No live interactions captured yet in Supabase. Ask a question in the chatbot!</td></tr>`;
            return;
        }

        body.innerHTML = LIVE_CONVERSATION_LOGS.slice(0, 6).map(log => `
            <tr>
                <td><strong>${log.session}</strong></td>
                <td>"${escapeHtml(log.query)}"</td>
                <td><code>${escapeHtml(log.intent || 'general')}</code></td>
                <td><span class="badge ${log.status.toLowerCase()}">${log.status}</span></td>
                <td>${log.time}</td>
            </tr>
        `).join('');
    }

    function renderFullLogsTable(filterText = '', filterStatus = 'all') {
        const body = document.getElementById('full-logs-table-body');
        if (!body) return;

        const filtered = LIVE_CONVERSATION_LOGS.filter(log => {
            const matchesText = (log.query || '').toLowerCase().includes(filterText.toLowerCase()) ||
                                (log.intent || '').toLowerCase().includes(filterText.toLowerCase()) ||
                                (log.session || '').toLowerCase().includes(filterText.toLowerCase());
            const matchesStatus = filterStatus === 'all' || (log.status || '').toLowerCase() === filterStatus.toLowerCase();
            return matchesText && matchesStatus;
        });

        if (filtered.length === 0) {
            body.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8; padding: 24px;">No matching conversation logs found</td></tr>`;
            return;
        }

        body.innerHTML = filtered.map(log => `
            <tr>
                <td><strong>${log.session}</strong></td>
                <td>"${escapeHtml(log.query)}"</td>
                <td><code>${escapeHtml(log.intent || 'general')}</code></td>
                <td><span class="badge type">${escapeHtml(log.type || 'direct')}</span></td>
                <td><span class="badge ${log.status.toLowerCase()}">${log.status}</span></td>
                <td>${log.time}</td>
            </tr>
        `).join('');
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 6. Live Search & Filter Controls
    const logSearchInput = document.getElementById('log-search');
    const logStatusFilter = document.getElementById('log-status-filter');
    const btnExportCSV = document.getElementById('btn-export-csv');

    function updateLogsFilter() {
        const query = logSearchInput ? logSearchInput.value : '';
        const status = logStatusFilter ? logStatusFilter.value : 'all';
        renderFullLogsTable(query, status);
    }

    if (logSearchInput) logSearchInput.addEventListener('input', updateLogsFilter);
    if (logStatusFilter) logStatusFilter.addEventListener('change', updateLogsFilter);

    if (btnExportCSV) {
        btnExportCSV.addEventListener('click', () => {
            const headers = ['Session ID', 'User Query', 'Matched Intent', 'Match Type', 'Status', 'Timestamp'];
            const rows = LIVE_CONVERSATION_LOGS.map(l => [l.session, `"${(l.query || '').replace(/"/g, '""')}"`, l.intent, l.type, l.status, l.time]);
            const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
            const encodedUri = encodeURI(csvContent);
            const link = document.createElement('a');
            link.setAttribute('href', encodedUri);
            link.setAttribute('download', `rvce_chatbot_supabase_logs_${Date.now()}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast('Exported Supabase logs to CSV!');
        });
    }

    // 7. Settings Form Handler
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const config = {
                botName: document.getElementById('bot-name')?.value,
                botTone: document.getElementById('bot-tone')?.value,
                voiceEnabled: document.getElementById('toggle-voice')?.checked,
                nlpEnabled: document.getElementById('toggle-nlp')?.checked,
                moderationEnabled: document.getElementById('toggle-moderation')?.checked
            };
            localStorage.setItem('rvce_bot_config', JSON.stringify(config));
            showToast('Bot configuration saved locally!');
        });
    }

    // 8. Core Data Fetcher: Live Supabase Fetch
    async function fetchSupabaseData() {
        if (!supa) {
            console.warn('Supabase client unavailable');
            if (statusDot) statusDot.className = 'status-dot';
            if (statusText) statusText.textContent = 'Supabase Client Disconnected';
            return;
        }

        try {
            if (statusDot) statusDot.className = 'status-dot online';
            if (statusText) statusText.textContent = 'Supabase Connected';

            // 1. Fetch Interactions (recent queries)
            const { data: interactions, error: intErr, count: intCount } = await supa
                .from('interactions')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .limit(200);

            if (intErr) console.warn('Supabase interactions fetch error:', intErr);

            // 2. Fetch Sessions
            const { data: sessions, error: sessErr, count: sessCount } = await supa
                .from('sessions')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .limit(200);

            if (sessErr) console.warn('Supabase sessions fetch error:', sessErr);

            // 3. Fetch Leads
            const { data: leads, count: leadsCount } = await supa
                .from('leads')
                .select('*', { count: 'exact' })
                .limit(100);

            const totalQueries = intCount !== null && intCount !== undefined ? intCount : (interactions ? interactions.length : 0);
            const totalSessions = sessCount !== null && sessCount !== undefined ? sessCount : (sessions ? sessions.length : 0);
            const totalLeads = leadsCount !== null && leadsCount !== undefined ? leadsCount : (leads ? leads.length : 0);

            // Update UI Metric Cards
            const qEl = document.getElementById('metric-total-queries');
            if (qEl) qEl.textContent = totalQueries.toLocaleString();

            const uEl = document.getElementById('metric-active-users');
            if (uEl) uEl.textContent = totalSessions.toLocaleString();

            const lEl = document.getElementById('metric-total-leads');
            if (lEl) lEl.textContent = totalLeads.toLocaleString();

            const accEl = document.getElementById('metric-intent-accuracy');
            if (accEl) {
                if (interactions && interactions.length > 0) {
                    const resolved = interactions.filter(i => !i.is_unanswered && i.interaction_id !== 'unmatched').length;
                    const pct = Math.round((resolved / interactions.length) * 100);
                    accEl.textContent = `${pct}%`;
                } else {
                    accEl.textContent = '100%';
                }
            }

            // Transform Interactions for Tables & Charts
            const categoryCounts = {};
            const dayCounts = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun

            if (interactions && interactions.length > 0) {
                LIVE_CONVERSATION_LOGS = interactions.map(i => {
                    // Extract intent or topic
                    const intent = i.interaction_id || (i.event_type === 'message' ? 'query' : i.event_type) || 'general';
                    const category = intent.split('_')[0] || 'general';
                    categoryCounts[category] = (categoryCounts[category] || 0) + 1;

                    // Calculate day of week for chart
                    if (i.created_at) {
                        const d = new Date(i.created_at);
                        const day = (d.getDay() + 6) % 7; // Map Sun=0 to index 6, Mon=1 to 0
                        dayCounts[day]++;
                    }

                    return {
                        session: i.session_id ? (i.session_id.startsWith('#') ? i.session_id : '#' + i.session_id.slice(-8)) : '#anon',
                        query: i.query_text || (i.metadata && i.metadata.query) || (i.element && i.element.text) || i.event_type || 'interaction',
                        intent: intent,
                        type: i.event_type || 'message',
                        status: i.is_unanswered ? 'Pending' : 'Resolved',
                        time: timeAgo(i.created_at)
                    };
                });
            } else {
                LIVE_CONVERSATION_LOGS = [];
            }

            // Render updated tables & charts
            renderOverviewTable();
            renderFullLogsTable(logSearchInput?.value || '', logStatusFilter?.value || 'all');
            initCharts(dayCounts, categoryCounts);

        } catch (err) {
            console.error('Error in fetchSupabaseData:', err);
        }
    }

    // 9. Manual Refresh Button
    if (btnRefresh) {
        btnRefresh.addEventListener('click', async () => {
            btnRefresh.classList.add('spinning');
            await fetchSupabaseData();
            btnRefresh.classList.remove('spinning');
            showToast('Refreshed data from Supabase!');
        });
    }

    // 10. Initial load and periodic poll (every 10 seconds)
    initCharts();
    fetchSupabaseData();
    setInterval(fetchSupabaseData, 10000);
});
