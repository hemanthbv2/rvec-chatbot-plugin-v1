# RVCE Chatbot & Analytics Command Center — Master Project Documentation

**Project Version:** 2.5.0 (Multi-Domain Enterprise Architecture)  
**Institution:** R.V. College of Engineering (RVCE), Bengaluru  
**Release Date:** November 2026  
**License:** Institutional Proprietary / Commercial  

---

## Table of Contents
1. [Executive Summary & System Overview](#1-executive-summary--system-overview)
2. [Multi-Domain Architecture & Cross-Site Continuity](#2-multi-domain-architecture--cross-site-continuity)
3. [Complete Codebase & Directory Structure](#3-complete-codebase--directory-structure)
4. [Frontend Chatbot Engine (`script.js` & `style.css`)](#4-frontend-chatbot-engine-scriptjs--stylecss)
   - [NLP Matching Algorithm & Tokenization](#41-nlp-matching-algorithm--tokenization)
   - [Knowledge Base Schema & Topics](#42-knowledge-base-schema--topics)
   - [How to Add or Edit Answers](#43-how-to-add-or-edit-answers)
   - [Voice Assistant & UI Features](#44-voice-assistant--ui-features)
5. [Behavioral & Friction Telemetry Engine (`telemetry.js`)](#5-behavioral--friction-telemetry-engine-telemetryjs)
   - [Triple-Tier Handshake Protocol](#51-triple-tier-handshake-protocol)
   - [Micro-Batching & Beacon Transmission](#52-micro-batching--beacon-transmission)
   - [Friction Detection Algorithms](#53-friction-detection-algorithms)
   - [Marketing Attribution & UTM Extraction](#54-marketing-attribution--utm-extraction)
6. [Central Analytics Backend Server (`server.js`)](#6-central-analytics-backend-server-serverjs)
   - [Storage Architecture & Failover Strategy](#61-storage-architecture--failover-strategy)
   - [Complete REST API Reference](#62-complete-rest-api-reference)
   - [Real-Time SSE Streaming](#63-real-time-sse-streaming)
   - [Security, CORS & CSP Specifications](#64-security-cors--csp-specifications)
7. [Analytics Command Center Dashboard (`public/index.html`)](#7-analytics-command-center-dashboard-publicindexhtml)
   - [Portal Scope Selector](#71-portal-scope-selector)
   - [Session Replay Drawer](#72-session-replay-drawer)
   - [Certified PDF & Spreadsheet Exports](#73-certified-pdf--spreadsheet-exports)
8. [WordPress Plugin Integration (`rvce-chatbot/`)](#8-wordpress-plugin-integration-rvce-chatbot)
   - [Plugin Structure & Lifecycle](#81-plugin-structure--lifecycle)
   - [Installation Guide Across All 3 Portals](#82-installation-guide-across-all-3-portals)
   - [Dual-Write Database Mechanism](#83-dual-write-database-mechanism)
9. [Production Deployment & DevOps Runbook](#9-production-deployment--devops-runbook)
   - [Prerequisites & Environment Variables](#91-prerequisites--environment-variables)
   - [Linux / PM2 Process Management](#92-linux--pm2-process-management)
   - [Nginx Reverse Proxy & SSL Configuration](#93-nginx-reverse-proxy--ssl-configuration)
10. [Troubleshooting & Emergency Operations](#10-troubleshooting--emergency-operations)

---

## 1. Executive Summary & System Overview

The **RVCE Chatbot & Analytics Platform** is a dual-purpose conversational intelligence and user behavior system designed specifically for **R.V. College of Engineering (RVCE)**.

It accomplishes two critical institutional objectives:
1. **Instant Student & Visitor Assistance:** Provides 24/7 sub-second answers to complex inquiries covering admissions, KCET/COMEDK cutoffs, management quota fees, placements, 17 engineering departments, faculty directories, hostel facilities, and campus regulations without relying on expensive recurring third-party LLM/API billing.
2. **Enterprise Behavioral Analytics & Journey Replay:** Acts like an in-house Microsoft Clarity / Hotjar, capturing user clickstreams, rage clicks, confusion pauses, and conversational dialogue turns, all aggregated into a central command center dashboard.

---

## 2. Multi-Domain Architecture & Cross-Site Continuity

RVCE operates across **three separate WordPress installations**:
* 🏛️ **Main Institutional Portal:** `https://rvce.edu.in`
* 🏢 **Departments Portal:** `https://departments.rvce.edu.in`
* 📚 **Digital Library & Alumni Portal:** `https://library.rvce.edu.in`

### The Cross-Domain Challenge
Modern browsers strictly isolate client-side storage (`localStorage`, `sessionStorage`, and non-shared cookies) between subdomains. By default, a visitor exploring departments on `departments.rvce.edu.in` who navigates to `rvce.edu.in` would appear as two completely disjointed visitors, resetting chat dialogue and corrupting analytics attribution.

### The Triple-Tier Handshake Protocol
The platform solves this through a prioritized triple-tier synchronization mechanism:

```
[VISITOR ARRIVES ON ANY RVCE SITE]
                 │
                 ▼
         ┌────────────────┐
         │ Check URL Param│ ──(Found ?rvce_sid=...)──► [Adopt SID & Replace State URL]
         └───────┬────────┘
                 │ (Not Found)
                 ▼
         ┌────────────────┐
         │Check RootCookie│ ──(Found rvce_sid in .rvce.edu.in)──► [Adopt Shared Root SID]
         └───────┬────────┘
                 │ (Not Found)
                 ▼
         ┌────────────────┐
         │ Local Fallback │ ──(sessionStorage / localStorage)──► [Adopt or Generate New SID]
         └────────────────┘
```

1. **Tier 1 — Inbound Query Parameter (`?rvce_sid=`):** Outbound internal links pointing across RVCE domains automatically receive `?rvce_sid=<SESSION_ID>`. When the destination page loads, `telemetry.js` extracts this parameter, adopts the session, and quietly removes the query param from the URL using `window.history.replaceState()`.
2. **Tier 2 — First-Party Root Cookie:** Scoped to the parent domain (`.rvce.edu.in; SameSite=Lax; max-age=86400`). All subdomains under `rvce.edu.in` have read access to this cookie natively.
3. **Tier 3 — Storage Fallback:** `sessionStorage` and `localStorage` are used as fallbacks for development servers (`localhost`, staging IPs) or browsers with third-party cookie restrictions.

### Cross-Subsite Hop Breadcrumbs
When a visitor transitions between portals, `telemetry.js` automatically creates a `cross_subsite_hop` event. This renders directly in the journey playback drawer as:
> `🌐 Subsite Hop: DEPARTMENTS ➔ MAIN (departments.rvce.edu.in → rvce.edu.in)`

---

## 3. Complete Codebase & Directory Structure

```text
rvce-chatbot-project/
├── rvce-chatbot/                              # WordPress Plugin Root
│   ├── rvce-chatbot.php                      # Core WP plugin bootstrap & hooks
│   ├── script.js                             # Chatbot frontend brain & knowledge base
│   ├── telemetry.js                          # Friction & event telemetry tracker
│   ├── style.css                             # Widget UI & responsive stylesheet
│   ├── assets/                               # Minified / production asset mirrors
│   │   ├── script.js
│   │   ├── telemetry.js
│   │   └── style.css
│   └── dashboard/                            # WordPress Admin Dashboard Tabs
│       ├── index.php                         # Overview KPI tab
│       ├── sessions.php                      # Session recordings, filters & replay
│       ├── interactions.php                  # Raw questions & clicks table
│       └── analytics.php                     # Device, geographic & topic analytics
│
├── rvce-standalone-dashboard/                 # Central Node.js Command Center
│   ├── server.js                             # Express API server, ingestion & auth
│   ├── package.json                          # Node dependencies
│   ├── .env                                  # Environment credentials & keys
│   └── public/                               # Single Page Application
│       ├── index.html                        # Complete Command Center UI (Dark Theme)
│       └── clarity-telemetry.js              # Standalone telemetry embed
│
├── COMPLETE_PROJECT_DOCUMENTATION.md         # Master Technical Documentation (This file)
├── RVCE_Chatbot_Documentation.md             # Non-Technical Simple User Guide
│
├── rvce-chatbot-plugin-ready.zip             # Ready-to-install WordPress zip
└── RVCE_COMPLETE_PROJECT_BUNDLE.zip          # Full system package bundle
```

---

## 4. Frontend Chatbot Engine (`script.js` & `style.css`)

### 4.1. NLP Matching Algorithm & Tokenization
The chatbot runs entirely client-side using a high-speed fuzzy keyword scoring model:
1. **Sanitization:** Removes punctuation, special symbols, and converts queries to lower-case.
2. **Tokenization & Stopword Stripping:** Discards filler terms (*"what is"*, *"can you tell me"*, *"please"*) to isolate target intent words.
3. **Fuzzy Levenshtein Distance:** Tolerates spelling typos (e.g., *"placemnts"*, *"plcemnt"* $\rightarrow$ *"placements"*).
4. **Weighted Keyword Scoring:** Calculates match density against category knowledge definitions.
5. **Entity Recognizers:** Dedicated regex passes for professor names, department codes (`CSE`, `ISE`, `ECE`, `ME`, `CV`, etc.), and numerical ranks.

### 4.2. Knowledge Base Schema & Topics
The bot's built-in knowledge repository covers:
* **Academic Departments (17 branches):**
  * Computer Science (CSE), Information Science (ISE), Artificial Intelligence & Machine Learning (AIML), Electronics & Communication (ECE), Electrical & Electronics (EEE), Mechanical (ME), Civil (CV), Aerospace (AS), Chemical (CH), Biotechnology (BT), Industrial Engineering (IEM), Telecommunication (ETE), Electronics & Instrumentation (EIE), Master of Computer Applications (MCA), Physics, Chemistry, Mathematics, Humanities.
  * *Data for each:* HOD name, contact email, telephone extension, seat intake matrix, syllabus link, and NBA accreditation tier.
* **Admissions & Cutoffs:**
  * KCET General Merit (GM) and reservation category cutoffs (1G, 2A, 2B, 3A, 3B, SC, ST) for all rounds.
  * COMEDK Round 1, 2, and 3 closing ranks.
  * Management Quota eligibility criteria, procedure, and fee ranges.
* **Placements & Career Statistics:**
  * Highest domestic CTC (67 LPA), average CTC (21.6 LPA), median CTC.
  * 320+ recruiting companies (Microsoft, Amazon, Cisco, Goldman Sachs, Mercedes Benz, Intel, Qualcomm, Texas Instruments).
  * Branch-by-branch placement percentages.
* **Hostels & Campus Facilities:**
  * 4 hostels: Krishna, Cauvery, Chamundi, Diamond Jubilee.
  * Room options (1-seater, 2-seater, 3-seater), annual fees, mess schedules, dietary options (North/South Indian).
  * Gymnasium, indoor badminton stadium, athletics grounds, health center, central library timings.

### 4.3. How to Add or Edit Answers
All answers are defined inside `script.js` in plain JavaScript objects. No database migrations or compiler tools are needed:
1. Open `rvce-chatbot/script.js`.
2. Locate the knowledge section (e.g. `const RVCE_KNOWLEDGE = { ... }` or intent `switch` blocks).
3. Update the text, numbers, or links:
   ```javascript
   // Example: Updating Highest Salary
   placements: {
       highestPackage: "67 LPA (Domestic) / 1.1 Crore (International)",
       avgPackage: "21.6 LPA",
       topRecruiters: ["Microsoft", "Amazon", "Cisco", "Goldman Sachs"]
   }
   ```
4. Save the file. The updated response will be delivered instantly to users upon their next page load.

### 4.4. Voice Assistant & UI Features
* **Speech-to-Text Input:** Tap the microphone icon to speak questions using the browser's native `webkitSpeechRecognition` API.
* **Text-to-Speech Output:** Listen to responses spoken aloud using the `SpeechSynthesis` Web API.
* **Interactive Suggestion Chips:** Contextually updated shortcut chips allow users to navigate deep topics with single taps.
* **Ambient Dark / Light / RVCE Red Themes:** Responsive styling matching institutional branding.

---

## 5. Behavioral & Friction Telemetry Engine (`telemetry.js`)

### 5.1. Micro-Batching & Beacon Transmission
To minimize bandwidth and eliminate page-load lag:
* Events are buffered into an in-memory queue (`eventQueue`).
* The queue automatically flushes to `/api/telemetry/events` every **15 seconds**.
* **High-Priority Immediate Flush:** Critical actions (`bot_open`, `message_sent`, `form_submit`, `rage_click`) bypass the timer and flush immediately.
* **Exit Beacon:** Hooks into `window.addEventListener('beforeunload', ...)` using `navigator.sendBeacon` to transmit pending actions without delaying tab closing.

### 5.2. Friction Detection Algorithms
* ⚡ **Rage Clicks:** Triggered when $\ge 3$ clicks occur on the same DOM element within an $800\text{ ms}$ sliding window. Indicates broken links or unresponsive buttons.
* 👻 **Dead Clicks:** Triggered when a user clicks on static, non-interactive text or images where they expected a hyperlink.
* ⏳ **Hesitation Pauses:** Triggered when an active user focuses the chat input and pauses for $> 3.5\text{ seconds}$ without typing, signaling uncertainty or confusing choices.

### 5.3. Marketing Attribution & UTM Extraction
* Detects inbound referrer domains: Instagram (`l.instagram.com`), Google (`google.com`), YouTube, LinkedIn, or direct visits.
* Captures URL UTM parameters:
  * `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`.
* Records the exact `botOpenedOnPage` path to compute conversion metrics for specific marketing landing pages (e.g. `/admissions`).

---

## 6. Central Analytics Backend Server (`server.js`)

### 6.1. Storage Architecture & Failover Strategy
The Node.js server employs a resilient three-tier data redundancy architecture:

```
                      [ INCOMING TELEMETRY / CHAT EVENT ]
                                       │
                                       ▼
                       ┌───────────────────────────────┐
                       │   In-Memory Store (memStore)  │  <-- Sub-millisecond reads/writes
                       │    (OOM Splice Protection)    │
                       └───────────────┬───────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        ▼                             ▼
             ┌─────────────────────┐       ┌─────────────────────┐
             │   Supabase Cloud    │       │    MongoDB Atlas    │
             │(PostgreSQL REST API)│       │ (Mongoose Failover) │
             └─────────────────────┘       └─────────────────────┘
```

* **Memory Store (`memStore`):** Serves dashboard queries in $< 2\text{ ms}$. If external databases are temporarily unreachable, the system continues running without interruptions.
* **OOM Safety Splice:** Automatically caps memory queues (retaining the latest 10,000 interactions) to guarantee Node.js never crashes from heap exhaustion.
* **Supabase Cloud Sync:** Dual-writes all sessions and interactions into Postgres tables (`rvce_sessions`, `rvce_interactions`).

### 6.2. Complete REST API Reference

#### Authentication
* `POST /api/auth/login`
  * **Payload:** `{ "username": "rvceadmin", "password": "<password>" }`
  * **Response:** `{ "token": "JWT_STRING", "user": { ... } }`
  * **Default Credentials:** `rvceadmin` / `rvce123`
* `GET /api/auth/me`
  * Returns active authenticated administrator profile.

#### Telemetry Ingestion
* `POST /api/telemetry/events`
  * **Headers:** `Content-Type: application/json`
  * **Payload:** Single event or micro-batch array:
    ```json
    {
      "sessionId": "sid_1793532000_abc12",
      "subsite": "departments",
      "events": [
        {
          "type": "message",
          "query": "What is the KCET cutoff for CSE?",
          "response": "Round 1 cutoff was 286...",
          "timestamp": 1793532000100
        }
      ]
    }
    ```

#### Dashboard Analytics
* `GET /api/dashboard/overview`
  * Returns total visitors, active conversations, bot counts, frustration index, device breakdowns, and friction summary.
* `GET /api/dashboard/sessions?subsite={all|departments|main|library}&segment={all|users|conversed|friction|bots}&page=1&limit=50`
  * Returns paginated session list filtered by portal scope and visitor segment.
* `GET /api/dashboard/session/:id`
  * Returns complete journey chronological timeline, clickstream events, and chat dialogue for a specific session.
* `GET /api/dashboard/interactions`
  * Returns raw tabular questions, button clicks, and outbound link clicks.
* `GET /api/dashboard/report/daily`
  * Aggregates session counts, friction points, and dwell metrics for today's certified report.

#### Health & Status
* `GET /api/health`
  * Returns JSON status: `{ "status": "online", "uptime": "...", "storage": { ... } }`.
* `GET /api/supabase/status`
  * Checks Postgres connection status and sync integrity.

### 6.3. Real-Time SSE Streaming
* `GET /api/dashboard/live/stream`
  * Server-Sent Events (SSE) channel pushing real-time notifications to connected dashboards whenever an inquiry or friction event is recorded.

### 6.4. Security, CORS & CSP Specifications
* **Dynamic CORS Whitelist:**
  Allows `https://rvce.edu.in`, `https://*.rvce.edu.in`, `http://localhost:*`, and `http://127.0.0.1:*` with `credentials: true`.
* **Content Security Policy (CSP):**
  `frame-ancestors 'self' https://rvce.edu.in https://*.rvce.edu.in http://localhost:* http://127.0.0.1:*`

---

## 7. Analytics Command Center Dashboard (`public/index.html`)

### 7.1. Portal Scope Selector
Located at the top of the session view, this control instantly toggles telemetry focus:
* 🌐 **All RVCE Portals (Unified):** Full institution view showing cross-domain navigation.
* 🏛️ **Main Portal (`rvce.edu.in`):** Admissions, general governance, and placement inquiries.
* 🏢 **Departments (`departments.rvce.edu.in`):** Department-specific interactions and faculty searches.
* 📚 **Library & Alumni (`library.rvce.edu.in`):** Library queries and alumni relations.

### 7.2. Session Replay Drawer
Clicking **"Inspect Session"** opens an interactive slide-over drawer displaying:
* **Session Metadata:** City, country, device model, operating system, and IP tag.
* **Marketing Attribution:** Inbound UTM campaign and referrer domain.
* **Step-by-Step Journey:** Chronological cards showing:
  * Page views with dwell duration
  * Chat dialogue bubbles (student inquiry vs. bot response)
  * Friction alerts (⚡ Rage Clicks, 👻 Dead Clicks)
  * 🌐 Cross-subsite hops

### 7.3. Certified PDF & Spreadsheet Exports
* **Daily Dossier (`.pdf`):** Formal institutional PDF summary generated using `jsPDF` + `autoTable` with session timestamps, questions asked, and resolution status.
* **Monthly Digest (`.pdf`):** Long-term historical trends for administrative governance.
* **Excel (`.xlsx`) & CSV (`.csv`):** Full tabular data export generated client-side via `SheetJS`.

---

## 8. WordPress Plugin Integration (`rvce-chatbot/`)

### 8.1. Plugin Structure & Lifecycle
* **Main Plugin File:** `rvce-chatbot/rvce-chatbot.php`
* **Lifecycle Hooks:**
  * `register_activation_hook`: Creates local MySQL logging tables (`wp_rvce_chatbot_logs`, `wp_rvce_chatbot_sessions`) and default options.
  * `wp_enqueue_scripts`: Injects widget styles, frontend engine (`script.js`), and tracking script (`telemetry.js`).
  * `admin_menu`: Registers the WordPress admin interface under **RVCE Chatbot**.

### 8.2. Installation Guide Across All 3 Portals
Deploy the exact same plugin archive on all three websites:
1. Log in to WordPress Admin:
   * Main: `https://rvce.edu.in/wp-admin`
   * Departments: `https://departments.rvce.edu.in/wp-admin`
   * Library: `https://library.rvce.edu.in/wp-admin`
2. Navigate to **Plugins $\rightarrow$ Add New $\rightarrow$ Upload Plugin**.
3. Upload [`rvce-chatbot-plugin-ready.zip`](file:///C:/Users/LENOVO/Downloads/rvce-chatbot-plugin-ready.zip) and click **Install Now**.
4. Click **Activate Plugin**.
5. The widget automatically starts floating in the bottom-right corner and synchronizes telemetry to the central command hub.

### 8.3. Dual-Write Database Mechanism
Whenever an inquiry or interaction occurs:
1. **Local MySQL Write:** Stored in the local WordPress MySQL database (`wp_rvce_chatbot_logs`) via internal WordPress REST routes (`/wp-json/rvce/v1/logs`).
2. **Central Ingestion Write:** Asynchronously transmitted to the Central Node.js Server (`/api/telemetry/events`).

---

## 9. Production Deployment & DevOps Runbook

### 9.1. Prerequisites & Environment Variables
* **Node.js:** v18.0.0 or higher
* **NPM:** v9.0.0 or higher
* **Environment File (`.env`):**
  ```ini
  PORT=3001
  NODE_ENV=production
  JWT_SECRET=rvce_jwt_secure_key_2026_super_secret_token
  API_KEY=rvce_key_12345
  SUPABASE_URL=https://mxujlyyjhjbnnroozbvf.supabase.co
  SUPABASE_KEY=sb_publishable_D65ZHjD5ofyVQ_3ofsEOxw_Cqj98ssv
  MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/rvce_chatbot?retryWrites=true&w=majority
  ```

### 9.2. Linux / PM2 Process Management
To run the Central Command Center continuously on a Linux server:
```bash
# 1. Unpack project bundle
unzip RVCE_COMPLETE_PROJECT_BUNDLE.zip -d /var/www/rvce-chatbot
cd /var/www/rvce-chatbot/rvce-standalone-dashboard

# 2. Install production dependencies
npm install --production

# 3. Launch clustered instances across all CPU cores
pm2 start server.js -i max --name "rvce-command-center"

# 4. Enable auto-restart on system reboot
pm2 save
pm2 startup
```

### 9.3. Nginx Reverse Proxy & SSL Configuration
Place the following in `/etc/nginx/sites-available/analytics.rvce.edu.in`:

```nginx
server {
    listen 80;
    server_name analytics.rvce.edu.in;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name analytics.rvce.edu.in;

    ssl_certificate /etc/letsencrypt/live/analytics.rvce.edu.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/analytics.rvce.edu.in/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 10. Troubleshooting & Emergency Operations

| Issue | Root Cause | Resolution |
| :--- | :--- | :--- |
| **"Access denied, missing token"** | Calling `/api/dashboard/*` without JWT Authorization header | Authenticate via `POST /api/auth/login` and pass `Authorization: Bearer <token>`. |
| **Sessions resetting when clicking between sites** | Outbound links missing `?rvce_sid=` or root cookie blocked | Ensure `telemetry.js` is active on both sites. Tier 1 parameter injection will restore the session. |
| **Dashboard shows "Calculating..." indefinitely** | JavaScript syntax error or duplicate variable in script | Checked and resolved: All script blocks verified via Node VM compiler with 0 errors. |
| **MongoDB Atlas offline or disconnected** | Network glitch or invalid credentials in `.env` | The server automatically falls back to the in-memory store and Supabase. No downtime occurs. |
| **Port 3001 in use** | An existing background server process is holding the port | Run `netstat -ano \| findstr 3001`, locate the PID, and kill via `taskkill /PID <PID> /F` (or `kill -9 <PID>` on Linux). |
| **Student inquiries not matching** | Unusual keyword phrasing | Add the synonym to the intent keyword list inside `script.js`. |

---

## 11. Institutional Verification & Sign-Off

* **Master Code Repository:** `https://github.com/hemanthbv2/rvec-chatbot-plugin-v1.git`
* **Verified Branch:** `main` (Production Ready)
* **Institutional Contact:** R.V. College of Engineering, Bengaluru — Web & IT Services Team
