<?php
if (!defined('ABSPATH')) exit;

$vercel_url = get_option('rvce_chatbot_vercel_url', 'http://localhost:3001');
$rest_url   = rest_url('rvce/v1');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RVCE Intelligence — Visitor Session Recordings</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #e31e24;
            --primary-glow: rgba(227, 30, 36, 0.35);
            --secondary: #6366f1;
            --secondary-glow: rgba(99, 102, 241, 0.35);
            --accent: #38bdf8;
            --success: #10b981;
            --warning: #f59e0b;
            --danger: #ef4444;
            --bg: #030712;
            --sidebar: rgba(15, 23, 42, 0.85);
            --card-bg: rgba(30, 41, 59, 0.45);
            --card-border: rgba(255, 255, 255, 0.08);
            --text-main: #f8fafc;
            --text-dim: #94a3b8;
            --border: rgba(255, 255, 255, 0.08);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background: var(--bg);
            color: var(--text-main);
            min-height: 100vh;
            display: flex;
            overflow-x: hidden;
        }

        /* Mesh Background */
        .mesh-bg {
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 40%),
                        radial-gradient(circle at 90% 80%, rgba(227, 30, 36, 0.1) 0%, transparent 40%),
                        radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.95) 0%, rgba(3, 7, 18, 1) 100%);
            z-index: -1;
            pointer-events: none;
        }

        /* Sidebar Navigation */
        aside {
            width: 260px;
            background: var(--sidebar);
            backdrop-filter: blur(20px);
            border-right: 1px solid var(--border);
            display: flex;
            flex-direction: column;
            padding: 24px 18px;
            flex-shrink: 0;
            z-index: 20;
        }

        .logo {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 32px;
            padding: 0 4px;
        }

        .logo-box {
            width: 38px;
            height: 38px;
            background: var(--primary);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            font-size: 16px;
            color: #fff;
            box-shadow: 0 0 16px var(--primary-glow);
        }

        .logo-text h2 { font-size: 17px; font-weight: 800; color: #fff; line-height: 1.2; }
        .logo-text p { font-size: 10px; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.8px; }

        nav { list-style: none; display: flex; flex-direction: column; gap: 6px; flex-grow: 1; }

        .ni {
            padding: 12px 14px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--text-dim);
            text-decoration: none;
            font-size: 13.5px;
            font-weight: 600;
            transition: all 0.2s;
        }

        .ni:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
        .ni.active {
            background: rgba(99, 102, 241, 0.15);
            color: #c7d2fe;
            border: 1px solid rgba(99, 102, 241, 0.35);
        }

        .ni svg { width: 18px; height: 18px; opacity: 0.85; flex-shrink: 0; }

        /* Main View Container */
        main {
            flex-grow: 1;
            padding: 28px 34px;
            overflow-y: auto;
            max-width: calc(100vw - 260px);
        }

        .top-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 24px;
            flex-wrap: wrap;
            gap: 14px;
        }

        .title-group h1 { font-size: 22px; font-weight: 800; color: #fff; }
        .title-group p { font-size: 13px; color: var(--text-dim); margin-top: 3px; }

        /* Global KPI Header Counters */
        .kpi-strip {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 12px;
            margin-bottom: 22px;
        }

        .kpi-box {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 14px 16px;
        }

        .kpi-box .lbl { font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 700; }
        .kpi-box .val { font-size: 22px; font-weight: 800; color: #fff; margin-top: 4px; }
        .kpi-box .sub { font-size: 11px; color: var(--text-dim); margin-top: 2px; }

        /* Segment Filter Bar */
        .segment-filter-container {
            display: flex;
            align-items: center;
            gap: 12px;
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 8px 14px;
            margin-bottom: 18px;
            flex-wrap: wrap;
        }

        .segment-pill-group { display: flex; gap: 8px; flex-wrap: wrap; }

        .segment-pill {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            color: var(--text-dim);
            padding: 6px 13px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .segment-pill:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
        .segment-pill.active {
            background: rgba(99, 102, 241, 0.2);
            border-color: #6366f1;
            color: #c7d2fe;
            box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
        }

        /* Buttons & Badges */
        .btn {
            padding: 7px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 700;
            cursor: pointer;
            border: 1px solid transparent;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
            text-decoration: none;
        }

        .btn-indigo { background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.4); color: #c7d2fe; }
        .btn-indigo:hover { background: rgba(99, 102, 241, 0.35); color: #fff; }

        .btn-secondary { background: rgba(255, 255, 255, 0.06); border-color: var(--border); color: #cbd5e1; }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.12); color: #fff; }

        .tag {
            padding: 3px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 700;
            display: inline-block;
        }

        .tag-blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
        .tag-green { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .tag-red { background: rgba(239, 68, 68, 0.18); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.35); }
        .tag-amber { background: rgba(245, 158, 11, 0.18); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.35); }
        .tag-gray { background: rgba(148, 163, 184, 0.12); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.25); }
        .tag-purple { background: rgba(168, 85, 247, 0.18); color: #d8b4fe; border: 1px solid rgba(168, 85, 247, 0.35); }

        /* Filter Pills in Table Header */
        .filter-pill {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid var(--border);
            color: var(--text-dim);
            padding: 5px 11px;
            border-radius: 8px;
            font-size: 11.5px;
            font-weight: 600;
            cursor: pointer;
        }
        .filter-pill.active { background: rgba(99, 102, 241, 0.2); color: #c7d2fe; border-color: #818cf8; }

        /* Table */
        .table-card {
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 14px;
            overflow: hidden;
        }

        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 12.5px; }
        thead tr { background: rgba(15, 23, 42, 0.85); border-bottom: 1px solid var(--border); }
        th { padding: 12px 16px; font-size: 11px; text-transform: uppercase; color: var(--text-dim); font-weight: 700; letter-spacing: 0.5px; }
        td { padding: 12px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.04); vertical-align: middle; }
        tbody tr:hover { background: rgba(99, 102, 241, 0.05); }

        /* Slide-over Replay Drawer */
        .drawer-overlay {
            position: fixed;
            top: 0; right: -650px;
            width: 620px; height: 100vh;
            background: #0b0f19;
            border-left: 1px solid var(--border);
            box-shadow: -10px 0 35px rgba(0, 0, 0, 0.7);
            z-index: 1000;
            transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            display: flex;
            flex-direction: column;
        }

        .drawer-overlay.open { right: 0; }

        .drawer-header {
            padding: 18px 24px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: rgba(15, 23, 42, 0.9);
        }

        .drawer-body {
            flex-grow: 1;
            overflow-y: auto;
            padding: 22px;
        }

        .drawer-tabs {
            display: flex;
            gap: 10px;
            padding: 12px 24px;
            background: rgba(15, 23, 42, 0.6);
            border-bottom: 1px solid var(--border);
        }

        .drawer-tab {
            padding: 6px 14px;
            border-radius: 8px;
            font-size: 12px;
            font-weight: 600;
            color: var(--text-dim);
            cursor: pointer;
        }

        .drawer-tab.active { background: rgba(99, 102, 241, 0.2); color: #fff; border: 1px solid #818cf8; }

        /* Chat dialogue bubbles */
        .chat-bubble {
            padding: 10px 14px;
            border-radius: 12px;
            margin-bottom: 10px;
            max-width: 85%;
            font-size: 13px;
            line-height: 1.4;
        }
        .bubble-user { background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.35); align-self: flex-end; margin-left: auto; }
        .bubble-bot { background: rgba(30, 41, 59, 0.8); border: 1px solid var(--border); margin-right: auto; }

        /* Timeline step */
        .timeline-step { display: flex; gap: 14px; margin-bottom: 14px; }
        .step-dot { width: 10px; height: 10px; border-radius: 50%; background: #6366f1; margin-top: 5px; flex-shrink: 0; }
        .step-dot.rage { background: #ef4444; }
        .step-dot.dead { background: #f59e0b; }
        .step-dot.msg { background: #10b981; }
    </style>
</head>
<body>
    <div class="mesh-bg"></div>

    <!-- Sidebar Navigation -->
    <aside>
        <div class="logo">
            <div class="logo-box">RV</div>
            <div class="logo-text">
                <h2>RVCE Command</h2>
                <p>WordPress Telemetry</p>
            </div>
        </div>

        <nav>
            <a class="ni" href="?action=rvce_chatbot_dashboard_view&tab=index">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                Overview
            </a>
            <a class="ni" href="?action=rvce_chatbot_dashboard_view&tab=interactions">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                Interactions
            </a>
            <a class="ni active" href="?action=rvce_chatbot_dashboard_view&tab=sessions">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                Session Recordings
            </a>
            <a class="ni" href="?action=rvce_chatbot_dashboard_view&tab=analytics">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                Keyword Analytics
            </a>
        </nav>

        <div style="padding-top:16px; border-top:1px solid var(--border); font-size:11px; color:var(--text-dim);">
            <div>⚡ Mode: <span style="color:#10b981; font-weight:700;">Live Streaming</span></div>
            <div style="margin-top:4px;">Endpoint: <?php echo esc_html(parse_url($vercel_url, PHP_URL_HOST) ?: 'localhost:3001'); ?></div>
        </div>
    </aside>

    <!-- Main View: Visitor Session Recordings -->
    <main>
        <!-- Top Bar -->
        <div class="top-bar">
            <div class="title-group">
                <h1>Visitor Session Recordings</h1>
                <p>Inspect individual visitor journeys with full clickstream breadcrumbs, transcripts & replay</p>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <span class="tag tag-green" id="activeVisitorsBadge">🟢 Live Online</span>
                <button class="btn btn-secondary" onclick="loadSessionsData()">🔄 Refresh</button>
            </div>
        </div>

        <!-- Global KPI Header Row -->
        <div class="kpi-strip">
            <div class="kpi-box">
                <div class="lbl">Total Recorded Sessions</div>
                <div class="val" id="statSessions">--</div>
                <div class="sub" id="statSessionsSub">Live from command center</div>
            </div>
            <div class="kpi-box">
                <div class="lbl">Active Conversations</div>
                <div class="val" style="color:#10b981;" id="statConversations">--</div>
                <div class="sub" id="statConversationsSub">Engaged dialogues</div>
            </div>
            <div class="kpi-box">
                <div class="lbl">Bounced / Opened Only</div>
                <div class="val" style="color:#fbbf24;" id="statOpenedOnly">--</div>
                <div class="sub" id="statOpenedSub">Opened without query</div>
            </div>
            <div class="kpi-box">
                <div class="lbl">Friction / Rage Sessions</div>
                <div class="val" style="color:#ef4444;" id="statRage">--</div>
                <div class="sub" id="statRageSub">Rage & dead clicks</div>
            </div>
            <div class="kpi-box">
                <div class="lbl">Audience Split</div>
                <div class="val" style="color:#a855f7;" id="statBotRatio">--</div>
                <div class="sub" id="statBotSub">Humans vs Crawlers</div>
            </div>
        </div>

        <!-- Traffic Segment Filter Bar -->
        <div class="segment-filter-container">
            <div style="font-size:12px; font-weight:700; color:var(--text-dim); display:flex; align-items:center; gap:6px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;color:#818cf8;">
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                TRAFFIC SEGMENT:
            </div>
            <div class="segment-pill-group">
                <button class="segment-pill active" id="segPill-all" onclick="setTrafficSegment('all')">
                    🌐 All Traffic <span class="tag tag-gray" id="badgeSegAll">--</span>
                </button>
                <button class="segment-pill" id="segPill-users" onclick="setTrafficSegment('users')">
                    👤 Real Users <span class="tag tag-gray" id="badgeSegUsers">--</span>
                </button>
                <button class="segment-pill" id="segPill-conversed" onclick="setTrafficSegment('conversed')">
                    💬 Active Conversations <span class="tag tag-gray" id="badgeSegConversed">--</span>
                </button>
                <button class="segment-pill" id="segPill-opened" onclick="setTrafficSegment('opened')">
                    ⚡ Has Friction <span class="tag tag-gray" id="badgeSegOpened">--</span>
                </button>
                <button class="segment-pill" id="segPill-bots" onclick="setTrafficSegment('bots')">
                    🤖 Bots & Crawlers <span class="tag tag-gray" id="badgeSegBots">--</span>
                </button>
            </div>
        </div>

        <!-- Daily & Monthly Sessions Downloader & Export Suite -->
        <div style="background:rgba(15,23,42,0.85); border:1px solid rgba(99,102,241,0.35); border-radius:14px; padding:14px 20px; margin-bottom:18px; display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:14px; box-shadow:0 8px 24px rgba(0,0,0,0.25);">
            <div style="display:flex; align-items:center; gap:12px;">
                <div style="width:40px; height:40px; border-radius:10px; background:rgba(99,102,241,0.2); border:1px solid rgba(99,102,241,0.4); display:flex; align-items:center; justify-content:center; color:#818cf8; font-size:18px;">
                    📅
                </div>
                <div>
                    <div style="font-weight:700; color:#fff; font-size:14px; display:flex; align-items:center; gap:8px;">
                        Daily & Monthly Session Archiver Suite
                        <span class="tag tag-blue" style="font-size:10px;">Executive Dossier</span>
                    </div>
                    <div style="font-size:11.5px; color:var(--text-dim); margin-top:2px;">
                        Export chronological dialogue transcripts, timestamps, and friction diagnostics for any day or full month
                    </div>
                </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
                <div style="display:flex; align-items:center; gap:6px;">
                    <label for="dailyExportDatePicker" style="font-size:12px; color:var(--text-dim); font-weight:600;">Date / Month:</label>
                    <input type="date" id="dailyExportDatePicker" style="padding:6px 10px; border-radius:8px; background:rgba(30,41,59,0.85); border:1px solid var(--border); color:#fff; font-size:12px; outline:none; font-family:'JetBrains Mono', monospace;" title="Select date or month for export">
                </div>
                <button class="btn" onclick="downloadDailyPdf()" style="padding:7px 14px; font-size:12px; font-weight:700; background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.45); color:#fca5a5; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Download certified PDF report of selected day's total sessions">
                    📄 Download Day (.pdf)
                </button>
                <button class="btn" onclick="downloadMonthlyPdf()" style="padding:7px 14px; font-size:12px; font-weight:700; background:rgba(139,92,246,0.22); border:1px solid rgba(139,92,246,0.5); color:#d8b4fe; display:inline-flex; align-items:center; gap:6px; cursor:pointer;" title="Download complete monthly archival PDF of all sessions across the selected month">
                    📚 Download Month (.pdf)
                </button>
            </div>
        </div>

        <!-- Today's Activity & Live Sessions Accordion -->
        <div class="today-accordion-card" style="margin-bottom:20px; background:linear-gradient(135deg, rgba(30,41,59,0.7) 0%, rgba(15,23,42,0.9) 100%); border:1px solid rgba(99,102,241,0.3); border-radius:14px; overflow:hidden; box-shadow:0 8px 30px rgba(0,0,0,0.3);">
            <div onclick="toggleTodayAccordion()" style="display:flex; justify-content:space-between; align-items:center; padding:16px 20px; cursor:pointer; background:rgba(99,102,241,0.08); user-select:none; transition:background 0.2s;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div style="width:42px; height:42px; border-radius:12px; background:linear-gradient(135deg,#4f46e5,#7c3aed); display:flex; align-items:center; justify-content:center; box-shadow:0 4px 14px rgba(99,102,241,0.4); font-size:20px;">
                        📅
                    </div>
                    <div>
                        <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                            <span style="font-size:15px; font-weight:800; color:#fff;" id="todayAccordionTitle">Today's Live Activity</span>
                            <span id="todayDatePill" style="font-size:12px; color:#cbd5e1; font-weight:600; font-family:'JetBrains Mono',monospace;"></span>
                            <span id="todaySessionsCountPill" class="tag tag-blue" style="font-size:11px; font-weight:700; padding:3px 10px; background:rgba(99,102,241,0.25); border:1px solid #818cf8; color:#c7d2fe;">
                                ⏳ Calculating...
                            </span>
                        </div>
                        <div style="font-size:12px; color:#94a3b8; margin-top:3px;">
                            Chronological breakdown of today's visitors, conversational queries, dwell duration, and friction
                        </div>
                    </div>
                </div>

                <div style="display:flex; align-items:center; gap:10px;" onclick="event.stopPropagation()">
                    <button class="btn" onclick="downloadCompleteTodayPdf()" style="padding:8px 16px; font-size:12px; font-weight:700; background:linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); border:1px solid #ef4444; color:#fff; border-radius:8px; box-shadow:0 4px 14px rgba(220,38,38,0.35); display:inline-flex; align-items:center; gap:8px; cursor:pointer;" title="Download certified PDF dossier of all sessions recorded today at once">
                        📥 Download Complete Day's Sessions (.pdf)
                    </button>
                    <button class="btn btn-secondary" onclick="toggleTodayAccordion()" style="padding:8px 12px; border-radius:8px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);" title="Expand or collapse today's activity panel">
                        <span id="todayAccordionChevron" style="display:inline-block; transition:transform 0.3s; font-size:12px; color:#cbd5e1;">▼</span>
                    </button>
                </div>
            </div>

            <!-- Accordion Body -->
            <div id="todayAccordionBody" style="display:block; padding:18px 20px; border-top:1px solid rgba(255,255,255,0.06);">
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:16px;">
                    <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:12px 14px;">
                        <div style="font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:700;">Today's Total Visitors</div>
                        <div id="todayStatVisitors" style="font-size:22px; font-weight:800; color:#fff; margin-top:4px;">0</div>
                    </div>
                    <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:12px 14px;">
                        <div style="font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:700;">Dialogue Inquiries</div>
                        <div id="todayStatQueries" style="font-size:22px; font-weight:800; color:#818cf8; margin-top:4px;">0</div>
                    </div>
                    <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:12px 14px;">
                        <div style="font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:700;">Active Conversations</div>
                        <div id="todayStatConversations" style="font-size:22px; font-weight:800; color:#34d399; margin-top:4px;">0</div>
                    </div>
                    <div style="background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.07); border-radius:10px; padding:12px 14px;">
                        <div style="font-size:11px; text-transform:uppercase; color:#94a3b8; font-weight:700;">Friction / Rage Alerts</div>
                        <div id="todayStatFriction" style="font-size:22px; font-weight:800; color:#f87171; margin-top:4px;">0</div>
                    </div>
                </div>

                <div id="todaySessionsListContainer"></div>
            </div>
        </div>

        <!-- Table Container -->
        <div class="table-card">
            <!-- Filter Bar -->
            <div style="padding:16px 20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <input type="text" id="sessionSearchInput" placeholder="🔍 Search city, session, query..." oninput="handleSearchSessions(this.value)" style="padding:8px 14px; border-radius:9px; background:rgba(15,23,42,0.7); border:1px solid var(--border); color:#fff; font-size:12.5px; outline:none; width:220px;">
                    <button class="filter-pill active" onclick="filterSessions('all', this)">All</button>
                    <button class="filter-pill" onclick="filterSessions('rage', this)">⚡ Rage Clicks</button>
                    <button class="filter-pill" onclick="filterSessions('conversed', this)">💬 Conversed</button>
                    <button class="filter-pill" onclick="filterSessions('opened', this)">👁️ Opened Only</button>
                    <button class="filter-pill" onclick="filterSessions('bots', this)">🤖 Bots</button>
                    <button class="filter-pill" onclick="filterSessions('mobile', this)">📱 Mobile</button>
                    <button class="filter-pill" onclick="filterSessions('desktop', this)">💻 Desktop</button>
                </div>
                <div style="font-size:12px; color:var(--text-dim);" id="tableCountBadge">Loading sessions...</div>
            </div>

            <!-- Sessions Table -->
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Session & Visitor</th>
                            <th>Chat Started & Origin</th>
                            <th>In-Chat Activity</th>
                            <th>Chat Ended & Duration</th>
                            <th>Friction Status</th>
                            <th style="text-align:right;">Actions</th>
                        </tr>
                    </thead>
                    <tbody id="sessionsTableBody">
                        <tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:30px;">Connecting to telemetry stream...</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    </main>

    <!-- Slide-over Replay Drawer -->
    <div class="drawer-overlay" id="drawerOverlay">
        <div class="drawer-header">
            <div>
                <h3 id="drawerSessionId" style="font-size:15px; font-weight:800; color:#fff; font-family:'JetBrains Mono',monospace;">Replay</h3>
                <div id="drawerSessionMeta" style="font-size:11px; color:var(--text-dim); margin-top:2px;">Loading playback...</div>
            </div>
            <button class="btn btn-secondary" onclick="closeReplayDrawer()" style="padding:6px 12px; font-size:14px;">✕ Close</button>
        </div>

        <div class="drawer-tabs">
            <button class="drawer-tab active" id="tabBtnJourney" onclick="switchDrawerTab('journey')">🗺️ Clickstream Journey</button>
            <button class="drawer-tab" id="tabBtnChat" onclick="switchDrawerTab('chat')">💬 Dialogue Transcript</button>
            <button class="drawer-tab" id="tabBtnTimeline" onclick="switchDrawerTab('timeline')">⏱️ Event Stream</button>
        </div>

        <div class="drawer-body">
            <div id="drawerTabJourney" style="display:block;">
                <div id="drawerJourneyFlow" style="display:flex; flex-direction:column; gap:12px;"></div>
            </div>
            <div id="drawerTabChat" style="display:none; display:flex; flex-direction:column;">
                <div id="drawerChatWindow" style="display:flex; flex-direction:column;"></div>
            </div>
            <div id="drawerTabTimeline" style="display:none;">
                <div id="drawerTimeline"></div>
            </div>
        </div>
    </div>

    <script>
        const CENTRAL_API_BASE = "<?php echo esc_js(rtrim($vercel_url, '/')); ?>";
        const WP_REST_BASE     = "<?php echo esc_js(untrailingslashit($rest_url)); ?>";

        let cachedSessions = [];
        let currentSegment = 'all';
        let currentFilter = 'all';
        let currentSearch = '';

        function getApiUrl(endpoint) {
            if (CENTRAL_API_BASE) {
                return CENTRAL_API_BASE + endpoint;
            }
            return WP_REST_BASE + '/sessions-data';
        }

        async function loadSessionsData() {
            try {
                let url = getApiUrl('/api/dashboard/sessions') + '?segment=' + currentSegment + '&limit=100';
                let res = await fetch(url);
                if (!res.ok) {
                    // Try WP REST API fallback
                    res = await fetch(WP_REST_BASE + '/sessions-data');
                }
                const data = await res.json();
                cachedSessions = Array.isArray(data) ? data : (data.sessions || []);

                renderOverviewStrip(cachedSessions);
                renderTodayAccordion(cachedSessions);
                applyTableFilters();
            } catch (err) {
                console.error('Failed to load sessions:', err);
                const tbody = document.getElementById('sessionsTableBody');
                if (tbody) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger); padding:30px;">Error connecting to telemetry stream.</td></tr>';
            }
        }

        function renderOverviewStrip(sessions) {
            const total = sessions.length;
            const conversed = sessions.filter(s => s.chatEngagement === 'conversed' || (s.dialogue && s.dialogue.length > 0) || s.turns > 0).length;
            const opened = sessions.filter(s => s.chatEngagement === 'opened_only' || s.chatEngagement === 'browsed_only').length;
            const rage = sessions.filter(s => (s.metrics?.rageClicks > 0) || (s.metrics?.deadClicks > 0) || (s.rageClicks > 0)).length;
            const bots = sessions.filter(s => s.isBot || s.visitorType === 'bot').length;
            const humans = total - bots;

            document.getElementById('statSessions').textContent = total;
            document.getElementById('statConversations').textContent = conversed;
            document.getElementById('statConversationsSub').textContent = total > 0 ? (Math.round((conversed / total) * 100) + '% engagement') : '0%';
            document.getElementById('statOpenedOnly').textContent = opened;
            document.getElementById('statRage').textContent = rage;
            document.getElementById('statBotRatio').textContent = total > 0 ? (Math.round((bots / total) * 100) + '% Bots') : '0%';
            document.getElementById('statBotSub').textContent = humans + ' Humans · ' + bots + ' Crawlers';

            document.getElementById('badgeSegAll').textContent = total;
            document.getElementById('badgeSegUsers').textContent = humans;
            document.getElementById('badgeSegConversed').textContent = conversed;
            document.getElementById('badgeSegOpened').textContent = rage;
            document.getElementById('badgeSegBots').textContent = bots;
        }

        function setTrafficSegment(seg) {
            currentSegment = seg;
            document.querySelectorAll('.segment-pill').forEach(el => el.classList.remove('active'));
            const activePill = document.getElementById('segPill-' + seg);
            if (activePill) activePill.classList.add('active');
            loadSessionsData();
        }

        function filterSessions(filter, btn) {
            currentFilter = filter;
            document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
            if (btn) btn.classList.add('active');
            applyTableFilters();
        }

        function handleSearchSessions(val) {
            currentSearch = (val || '').toLowerCase().trim();
            applyTableFilters();
        }

        function applyTableFilters() {
            let list = cachedSessions;

            if (currentFilter === 'rage') list = list.filter(s => (s.metrics?.rageClicks > 0) || (s.rageClicks > 0));
            if (currentFilter === 'conversed') list = list.filter(s => s.chatEngagement === 'conversed' || (s.dialogue && s.dialogue.length > 0));
            if (currentFilter === 'opened') list = list.filter(s => s.chatEngagement === 'opened_only' || s.chatEngagement === 'browsed_only');
            if (currentFilter === 'bots') list = list.filter(s => s.isBot || s.visitorType === 'bot');
            if (currentFilter === 'mobile') list = list.filter(s => s.device?.type === 'mobile' || s.device?.type === 'Mobile');
            if (currentFilter === 'desktop') list = list.filter(s => s.device?.type === 'desktop' || s.device?.type === 'Desktop');

            if (currentSearch) {
                list = list.filter(s => 
                    (s.sessionId && s.sessionId.toLowerCase().includes(currentSearch)) ||
                    (s.lastQuery && s.lastQuery.toLowerCase().includes(currentSearch)) ||
                    (s.geo?.city && s.geo.city.toLowerCase().includes(currentSearch))
                );
            }

            document.getElementById('tableCountBadge').textContent = 'Showing ' + list.length + ' of ' + cachedSessions.length + ' sessions';
            renderTableRows(list);
        }

        function renderTableRows(sessions) {
            const tbody = document.getElementById('sessionsTableBody');
            if (!tbody) return;

            if (!sessions.length) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-dim); padding:30px;">No sessions found matching current filter.</td></tr>';
                return;
            }

            tbody.innerHTML = sessions.map(s => {
                const isRage = (s.metrics?.rageClicks > 0) || (s.rageClicks > 0);
                const isDead = (s.metrics?.deadClicks > 0) || (s.deadClicks > 0);
                const startDate = new Date(s.startTime || s.createdAt || Date.now());
                const endDate = new Date(s.lastActive || s.updatedAt || s.startTime || Date.now());
                const diffSec = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 1000));
                const mins = Math.floor(diffSec / 60);
                const secs = diffSec % 60;
                const durStr = mins > 0 ? (mins + 'm ' + secs + 's') : (secs + 's');

                const timeStr = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const turns = s.turns || (s.dialogue ? Math.ceil(s.dialogue.length / 2) : 0);
                const geoStr = s.geo ? (s.geo.city + ', ' + (s.geo.countryCode || s.geo.country || 'IN')) : 'Bengaluru, IN';
                const lastQ = s.lastQuery || (s.dialogue && s.dialogue.length > 0 ? s.dialogue[s.dialogue.length - 1].text : 'Browsed Portal');

                const rawRef = (s.referrer || 'Direct').toLowerCase();
                let sourceBadge = '';
                if (rawRef.includes('instagram') || rawRef.includes('insta')) {
                    sourceBadge = '<span class="tag" style="background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888); color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px; box-shadow:0 1px 4px rgba(220,39,67,0.3);">📷 Instagram</span>';
                } else if (rawRef.includes('google')) {
                    sourceBadge = '<span class="tag" style="background:#1e293b; color:#38bdf8; border:1px solid #38bdf8; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">🔍 Google</span>';
                } else if (rawRef.includes('linkedin')) {
                    sourceBadge = '<span class="tag" style="background:#0077b5; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">💼 LinkedIn</span>';
                } else {
                    sourceBadge = '<span class="tag" style="background:#1e293b; color:#94a3b8; border:1px solid #334155; font-size:10px; padding:2px 6px; border-radius:4px;">🌐 ' + (s.referrer || 'Direct') + '</span>';
                }

                const triggerPage = s.botOpenedOnPage || s.metrics?.bot_opened_on_page || s.metrics?.botOpenedOnPage || s.entryPage || s.landingPage || '/';

                return `
                    <tr>
                        <td>
                            <div style="font-family:'JetBrains Mono',monospace; font-weight:700; color:#818cf8; cursor:pointer;" onclick="openReplayDrawer('${s.sessionId}')">
                                ${s.sessionId.slice(0, 16)}...
                            </div>
                            <div style="display:flex; gap:4px; margin-top:4px; flex-wrap:wrap;">
                                ${s.isBot ? '<span class="tag tag-red">🤖 Crawler</span>' : '<span class="tag tag-blue">👤 Real Visitor</span>'}
                                ${(Array.isArray(s.subsitesTouched) && s.subsitesTouched.length > 1) ? '<span class="tag" style="background:rgba(236,72,153,0.2); border:1px solid #ec4899; color:#f472b6; font-size:10px; font-weight:700;">🌐 Cross-Portal</span>' : ''}
                                ${turns > 0 ? '<span class="tag tag-green">💬 Conversed</span>' : '<span class="tag tag-gray">🌐 Browsed</span>'}
                            </div>
                        </td>
                        <td>
                            <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
                                <span style="color:#10b981; font-weight:700;">${timeStr}</span>
                                ${sourceBadge}
                            </div>
                            <div style="font-size:11.5px; font-family:'JetBrains Mono',monospace; margin-top:3px;" title="Chatbot triggered on ${triggerPage}">
                                <span style="color:#38bdf8; font-weight:700;">📍 Opened on:</span>
                                <span style="color:#f8fafc; background:rgba(56,189,248,0.18); border:1px solid rgba(56,189,248,0.4); padding:1px 6px; border-radius:4px; font-weight:600;">${triggerPage}</span>
                            </div>
                            <div style="color:var(--text-dim); font-size:11px; margin-top:3px;">💻 ${s.device?.type || 'Desktop'} · ${geoStr}</div>
                        </td>
                        <td>
                            <div class="tag tag-indigo" style="margin-bottom:4px;">💬 ${turns} turn${turns === 1 ? '' : 's'}</div>
                            <div style="max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#fff; font-weight:600;" title="${lastQ}">
                                "${lastQ}"
                            </div>
                        </td>
                        <td>
                            <div style="color:#f43f5e; font-weight:700;">${durStr}</div>
                            <div style="color:var(--text-dim); font-size:11px; margin-top:2px;">Exit: ${s.exitPage || '/'}</div>
                        </td>
                        <td>
                            ${isRage ? '<span class="tag tag-red">⚡ Rage Clicks</span>' : ''}
                            ${isDead ? '<span class="tag tag-amber">👻 Dead Clicks</span>' : ''}
                            ${!isRage && !isDead ? '<span class="tag tag-green">✅ Smooth</span>' : ''}
                        </td>
                        <td style="text-align:right;">
                            <div style="display:inline-flex; gap:6px;">
                                <button class="btn btn-indigo" onclick="openReplayDrawer('${s.sessionId}')" title="Inspect journey replay">▶ Replay</button>
                                <button class="btn btn-secondary" onclick="downloadSingleSessionPdf('${s.sessionId}')" title="Export PDF dossier">📄 PDF</button>
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        // Today's Activity Accordion Logic
        function renderTodayAccordion(sessions) {
            const today = new Date();
            const todayY = today.getFullYear();
            const todayM = today.getMonth();
            const todayD = today.getDate();
            const todayIso = today.toISOString().split('T')[0];
            const displayDateStr = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });

            const datePill = document.getElementById('todayDatePill');
            if (datePill) datePill.textContent = displayDateStr;

            const todaySessions = sessions.filter(s => {
                if (!s) return false;
                const d = new Date(s.startTime || s.createdAt || 0);
                return d.getFullYear() === todayY && d.getMonth() === todayM && d.getDate() === todayD;
            });

            const countPill = document.getElementById('todaySessionsCountPill');
            if (countPill) {
                countPill.textContent = todaySessions.length + ' Sessions Today';
                countPill.style.background = todaySessions.length > 0 ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)';
                countPill.style.color = todaySessions.length > 0 ? '#6ee7b7' : '#c7d2fe';
            }

            document.getElementById('todayStatVisitors').textContent = todaySessions.length;
            let queriesCount = 0;
            let conversationsCount = 0;
            let frictionCount = 0;

            todaySessions.forEach(s => {
                const turns = s.turns || (s.dialogue ? Math.ceil(s.dialogue.length / 2) : 0);
                if (turns > 0) { queriesCount += turns; conversationsCount++; }
                if ((s.metrics && (s.metrics.rageClicks > 0 || s.metrics.deadClicks > 0)) || s.rageClicks > 0) frictionCount++;
            });

            document.getElementById('todayStatQueries').textContent = queriesCount;
            document.getElementById('todayStatConversations').textContent = conversationsCount;
            document.getElementById('todayStatFriction').textContent = frictionCount;

            const container = document.getElementById('todaySessionsListContainer');
            if (!container) return;

            if (todaySessions.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center; padding:20px; color:var(--text-dim); font-size:13px;">
                        No sessions recorded yet today (${displayDateStr}). Live incoming website sessions will appear here dynamically.
                    </div>
                `;
                return;
            }

            let miniTable = `
                <div style="overflow-x:auto;">
                    <table>
                        <thead>
                            <tr>
                                <th>Session ID</th><th>Time</th><th>Visitor Device</th><th>Turns</th><th>Status</th><th style="text-align:right;">Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

            todaySessions.forEach(s => {
                const d = new Date(s.startTime || s.createdAt || Date.now());
                const tStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const turns = s.turns || (s.dialogue ? Math.ceil(s.dialogue.length / 2) : 0);
                miniTable += `
                    <tr>
                        <td style="font-family:'JetBrains Mono',monospace; color:#818cf8; cursor:pointer; font-weight:700;" onclick="openReplayDrawer('${s.sessionId}')">${s.sessionId.slice(0, 16)}...</td>
                        <td>${tStr}</td>
                        <td style="color:var(--text-dim);">${s.device?.type || 'Desktop'} · ${s.geo?.city || 'Local'}</td>
                        <td><span class="tag tag-indigo">${turns} turns</span></td>
                        <td>${s.metrics?.rageClicks > 0 ? '<span class="tag tag-red">⚡ Rage Clicks</span>' : '<span class="tag tag-green">✓ Smooth</span>'}</td>
                        <td style="text-align:right;"><button class="btn btn-indigo" style="padding:4px 8px; font-size:11px;" onclick="openReplayDrawer('${s.sessionId}')">▶ Replay</button></td>
                    </tr>
                `;
            });
            miniTable += '</tbody></table></div>';
            container.innerHTML = miniTable;
        }

        function toggleTodayAccordion() {
            const body = document.getElementById('todayAccordionBody');
            const chevron = document.getElementById('todayAccordionChevron');
            if (!body) return;
            const isCollapsed = body.style.display === 'none';
            body.style.display = isCollapsed ? 'block' : 'none';
            if (chevron) chevron.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(-90deg)';
        }

        // PDF Downloads
        function downloadDailyPdf() {
            const dp = document.getElementById('dailyExportDatePicker');
            let date = dp ? dp.value : '';
            if (!date) date = new Date().toISOString().split('T')[0];
            window.open(CENTRAL_API_BASE + '/print-report.html?date=' + encodeURIComponent(date) + '&autoprint=true', '_blank');
        }

        function downloadMonthlyPdf() {
            const dp = document.getElementById('dailyExportDatePicker');
            let date = dp ? dp.value : '';
            let month = date ? date.slice(0, 7) : new Date().toISOString().slice(0, 7);
            window.open(CENTRAL_API_BASE + '/print-report.html?month=' + encodeURIComponent(month) + '&autoprint=true', '_blank');
        }

        function downloadCompleteTodayPdf() {
            const today = new Date().toISOString().split('T')[0];
            window.open(CENTRAL_API_BASE + '/print-report.html?date=' + encodeURIComponent(today) + '&autoprint=true', '_blank');
        }

        function downloadSingleSessionPdf(sid) {
            window.open(CENTRAL_API_BASE + '/print-report.html?session=' + encodeURIComponent(sid) + '&autoprint=true', '_blank');
        }

        // Slide-over Replay Drawer
        function openReplayDrawer(sessionId) {
            const overlay = document.getElementById('drawerOverlay');
            overlay.classList.add('open');

            const sess = cachedSessions.find(s => s.sessionId === sessionId) || { sessionId: sessionId };
            document.getElementById('drawerSessionId').textContent = 'Replay: ' + sessionId;
            const drawerRawRef = (sess.referrer || 'Direct').toLowerCase();
            let drawerSourceBadge = '';
            if (drawerRawRef.includes('instagram') || drawerRawRef.includes('insta')) {
                drawerSourceBadge = '<span class="tag" style="background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888); color:#fff; font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px;">📷 Instagram</span>';
            } else if (drawerRawRef.includes('google')) {
                drawerSourceBadge = '<span class="tag" style="background:#1e293b; color:#38bdf8; border:1px solid #38bdf8; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">🔍 Google</span>';
            } else if (drawerRawRef.includes('linkedin')) {
                drawerSourceBadge = '<span class="tag" style="background:#0077b5; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px;">💼 LinkedIn</span>';
            } else {
                drawerSourceBadge = '<span class="tag" style="background:#1e293b; color:#94a3b8; border:1px solid #334155; font-size:10px; padding:2px 6px; border-radius:4px;">🌐 ' + (sess.referrer || 'Direct') + '</span>';
            }

            const triggerPage = sess.botOpenedOnPage || sess.metrics?.bot_opened_on_page || sess.entryPage || sess.landingPage || '/';
            document.getElementById('drawerSessionMeta').innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:2px;">
                    <span>💻 ${(sess.device?.type || 'Desktop')} · ${(sess.geo?.city || 'Bengaluru')}</span>
                    <span style="color:#64748b;">•</span>
                    ${drawerSourceBadge}
                    <span style="color:#64748b;">•</span>
                    <span style="color:#38bdf8; font-family:'JetBrains Mono',monospace; font-weight:700;">📍 Opened on: <span style="background:rgba(56,189,248,0.18); border:1px solid rgba(56,189,248,0.4); padding:1px 6px; border-radius:4px; color:#fff;">${triggerPage}</span></span>
                </div>
            `;

            // Render Journey Flow
            const flowEl = document.getElementById('drawerJourneyFlow');
            const journey = sess.journey || [
                { step: 1, type: 'page_land', title: 'Landed on ' + (sess.entryPage || '/'), detail: 'Visitor session started from ' + (sess.referrer || 'Direct'), timeOffset: '+00:00' },
                { step: 2, type: 'bot_open', title: 'Opened RVCE Chatbot', detail: 'Chatbot widget launched by visitor', timeOffset: '+00:02' }
            ];
            flowEl.innerHTML = journey.map(j => `
                <div style="background:rgba(30,41,59,0.5); border:1px solid var(--border); border-radius:10px; padding:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:700; color:#fff;">#${j.step || ''} ${j.title || j.type}</span>
                        <span class="tag tag-indigo">${j.timeOffset || '00:00'}</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-dim); margin-top:4px;">${j.detail || ''}</div>
                </div>
            `).join('');

            // Render Dialogue
            const chatEl = document.getElementById('drawerChatWindow');
            if (sess.dialogue && sess.dialogue.length > 0) {
                chatEl.innerHTML = sess.dialogue.map(msg => `
                    <div class="chat-bubble bubble-${msg.sender}">
                        <strong>${msg.sender === 'user' ? 'Visitor' : 'RVCE Assistant'}:</strong>
                        <div style="margin-top:3px;">${msg.text}</div>
                    </div>
                `).join('');
            } else {
                chatEl.innerHTML = '<div style="color:var(--text-dim); text-align:center; padding:20px;">No conversational messages exchanged in this session.</div>';
            }

            // Render Timeline
            const timeEl = document.getElementById('drawerTimeline');
            timeEl.innerHTML = journey.map(j => `
                <div class="timeline-step">
                    <div class="step-dot ${j.type === 'rage_click' ? 'rage' : (j.type === 'dead_click' ? 'dead' : '')}"></div>
                    <div>
                        <div style="font-weight:700; color:#fff;">${j.title || j.type}</div>
                        <div style="font-size:11px; color:var(--text-dim);">${j.timeOffset || ''} · ${j.detail || ''}</div>
                    </div>
                </div>
            `).join('');

            switchDrawerTab('journey');
        }

        function closeReplayDrawer() {
            document.getElementById('drawerOverlay').classList.remove('open');
        }

        function switchDrawerTab(tab) {
            document.getElementById('tabBtnJourney').classList.toggle('active', tab === 'journey');
            document.getElementById('tabBtnChat').classList.toggle('active', tab === 'chat');
            document.getElementById('tabBtnTimeline').classList.toggle('active', tab === 'timeline');

            document.getElementById('drawerTabJourney').style.display = tab === 'journey' ? 'block' : 'none';
            document.getElementById('drawerTabChat').style.display = tab === 'chat' ? 'flex' : 'none';
            document.getElementById('drawerTabTimeline').style.display = tab === 'timeline' ? 'block' : 'none';
        }

        window.onload = () => {
            const dp = document.getElementById('dailyExportDatePicker');
            if (dp && !dp.value) dp.value = new Date().toISOString().split('T')[0];
            loadSessionsData();
            setInterval(loadSessionsData, 15000);
        };
    </script>
</body>
</html>
