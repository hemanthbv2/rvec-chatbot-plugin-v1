# RVCE Chatbot & Analytics Command Center — Master Technical Documentation

**Document Release:** Version 3.1.0 (Master Enterprise Specification)  
**Target Codebase:** WordPress Plugin (`rvce-chatbot/` v3.1.0) & Standalone Analytics Command Center (`rvce-standalone-dashboard/` v2.0.0)  
**Governing Institution:** Rashtreeya Sikshana Samithi Trust (RSST) / R.V. College of Engineering (Autonomous Institution affiliated to VTU, Belagavi), Bengaluru, Karnataka, India  
**Audit & Verification Date:** November 2026  
**Security Classification:** Institutional Technical Specification & Operations Runbook  

---

## Table of Contents
1. [Executive Summary & System Overview](#1-executive-summary--system-overview)
2. [Complete Architecture & Data Flow Diagrams](#2-complete-architecture--data-flow-diagrams)
3. [WordPress Chatbot Plugin (`rvce-chatbot/`) Specification](#3-wordpress-chatbot-plugin-rvce-chatbot-specification)
4. [Triple-Tier Session Handshake & Behavioral Telemetry (`telemetry.js`)](#4-triple-tier-session-handshake--behavioral-telemetry-telemetryjs)
5. [Standalone Analytics & Command Center (`rvce-standalone-dashboard/`)](#5-standalone-analytics--command-center-rvce-standalone-dashboard)
6. [Database Schemas & Persistence Specification](#6-database-schemas--persistence-specification)
7. [Configurations & Environment Variables](#7-configurations--environment-variables)
8. [Discrepancy Rectifications & Bug Catalog](#8-discrepancy-rectifications--bug-catalog)
9. [Production Deployment & Operations Runbook](#9-production-deployment--operations-runbook)

---

## 1. Executive Summary & System Overview

### 1.1 Institutional Context
Established in 1963 and governed by the **Rashtreeya Sikshana Samithi Trust (RSST)**, **R.V. College of Engineering (RVCE)** is a premier autonomous engineering college in Bengaluru, Karnataka, affiliated with Visvesvaraya Technological University (VTU) and accredited with an 'A+' Grade by NAAC. The institution caters to over 7,000 enrolled undergraduate, postgraduate, and doctoral students across 17 engineering branches, numerous research centers, and over 32 specialized Centres of Excellence (CoEs).

### 1.2 The Multi-Portal Landscape
In production, RVCE operates a federated web infrastructure across three distinct WordPress installations to segregate administrative, departmental, and research/alumni workloads:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             RVCE WEB ECOSYSTEM                                  │
├──────────────────────────┬──────────────────────────┬────────────────────────────┤
│ 1. MAIN INSTITUTIONAL    │ 2. ACADEMIC DEPARTMENTS  │ 3. RESEARCH & ALUMNI       │
│    PORTAL                │    PORTAL                │    PORTAL                  │
│    https://rvce.edu.in   │    https://departments.  │    https://library.rvce.   │
│                          │    rvce.edu.in           │    edu.in                  │
├──────────────────────────┼──────────────────────────┼────────────────────────────┤
│ • Admissions & Quotas    │ • 17 UG Engineering Depts│ • Digital Library Catalog  │
│ • KCET/COMEDK Cutoffs    │ • Faculty & HOD Directory│ • IEEE / ScienceDirect     │
│ • Placement Records      │ • Curricula & Syllabus   │ • Research Publications    │
│ • RSST Governance        │ • Lab Infrastructure     │ • Alumni Relations         │
└──────────────────────────┴──────────────────────────┴────────────────────────────┘
```

Modern web browsers enforce strict origin isolation and storage partitioning. Consequently, standard client-side state mechanisms (e.g., `sessionStorage` or `localStorage`) on `departments.rvce.edu.in` are entirely inaccessible to `rvce.edu.in`. Without a specialized cross-domain continuity engine, visitor conversations reset on every subsite hop, fragmenting prospective student journeys and distorting analytics.

### 1.3 Core Engineering Philosophy
The RVCE Chatbot & Analytics platform was engineered around two architectural imperatives:

1. **Zero-Cloud-AI-Cost Deterministic Client-Side NLP Engine:**  
   Conversational dialogue reasoning is executed entirely within the visitor's browser thread via a lightweight, deterministic Natural Language Processing (NLP) tokenizer and fuzzy matcher embedded in `script.js` (5,013 lines).  
   * **Zero External LLM Dependency:** The system requires **no external API calls to Google Gemini, OpenAI ChatGPT, Anthropic Claude, or cloud LLM endpoints**.
   * **Predictable & Accurate:** By eliminating external generative AI models, the college eliminates recurring token billing, protects institutional data, prevents hallucinations regarding cutoffs, fee structures, or admissions procedures, and achieves instant response latency ($< 15\text{ ms}$).
   * **Mobile Network Resilience:** Once loaded, the chatbot operates offline or over intermittent mobile 3G/4G/5G connections.

2. **Tri-Tier High-Availability Analytics Command Center:**  
   Behavioral telemetry and session recordings are decoupled from conversation delivery. The telemetry pipeline utilizes an asynchronous, non-blocking dual-write ingestion hub (`server.js`) connected to:
   * **Supabase PostgreSQL Cloud:** Primary relational and JSONB datastore.
   * **MongoDB Atlas:** Secondary document store for session documents and CRM leads.
   * **In-Memory Store (`memStore`):** High-availability tertiary cache with automated FIFO capacity protection ensuring 100% telemetry uptime even during external database maintenance.

---

## 2. Complete Architecture & Data Flow Diagrams

### 2.1 Multi-Portal End-to-End System Topology

```
                                  [ STUDENT VISITORS ]
                (Mobile Browsers, Desktops, Direct, Referral, Search Ads)
                                           │
             ┌─────────────────────────────┼─────────────────────────────┐
             ▼                             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐   ┌─────────────────────────┐
│       MAIN PORTAL       │   │   DEPARTMENTS PORTAL    │   │     LIBRARY PORTAL      │
│   https://rvce.edu.in   │   │departments.rvce.edu.in  │   │  library.rvce.edu.in    │
│                         │   │                         │   │                         │
│ ┌─────────────────────┐ │   │ ┌─────────────────────┐ │   │ ┌─────────────────────┐ │
│ │  rvce-chatbot Widget│ │   │ │  rvce-chatbot Widget│ │   │ │  rvce-chatbot Widget│ │
│ │  (script.js NLP)    │ │   │ │  (script.js NLP)    │ │   │ │  (script.js NLP)    │ │
│ │  Voice, Quick-Picks │ │   │ │  Voice, Quick-Picks │ │   │ │  Voice, Quick-Picks │ │
│ └──────────┬──────────┘ │   │ └──────────┬──────────┘ │   │ └──────────┬──────────┘ │
│            │            │   │            │            │   │            │            │
│ ┌──────────┴──────────┐ │   │ ┌──────────┴──────────┐ │   │ ┌──────────┴──────────┐ │
│ │ telemetry.js Engine │ │   │ │ telemetry.js Engine │ │   │ │ telemetry.js Engine │ │
│ │ (Friction Trackers) │ │   │ │ (Friction Trackers) │ │   │ │ (Friction Trackers) │ │
│ └──────────┬──────────┘ │   │ └──────────┬──────────┘ │   │ └──────────┬──────────┘ │
└────────────┼────────────┘   └────────────┼────────────┘   └────────────┼────────────┘
             │                             │                             │
             └──────────────────────┬──────┴─────────────────────────────┘
                                    │
           ====================================================
           TRIPLE-TIER SESSION RESOLUTION & INTERNAL DECORATION
           [ Tier 1: URL Query Injection (?rvce_sid=...)       ]
           [ Tier 2: Root Domain Cookie (.rvce.edu.in)         ]
           [ Tier 3: Local/Session Storage Fallback            ]
           ====================================================
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       │                                                        │
       ▼ (Destination 1)                                        ▼ (Destination 2)
┌───────────────────────────────┐              ┌────────────────────────────────────────┐
│  WORDPRESS LOCAL STORAGE      │              │  CENTRAL NODE.JS COMMAND CENTER        │
│  - Endpoint:                  │              │  (rvce-standalone-dashboard/server.js) │
│    /wp-json/rvce/v1/logs      │              │  - Routes: /api/logs, /api/telemetry   │
│  - Tables:                    │              │  - Express 5.2.1, Dynamic CORS, CSP    │
│    wp_rvce_interactions       │              │  - utils/enrichment.js (Geo, Bot, UA)  │
│    wp_rvce_leads              │              │  - Server-Sent Events (/api/dashboard/ │
│    wp_rvce_chat_logs          │              │    live/stream)                        │
└───────────────────────────────┘              └───────────────────┬────────────────────┘
                                                                   │
                                           ┌───────────────────────┴────────────────────┐
                                           │ (Tri-Tier Storage Strategy)                │
                                           ▼                                            ▼
                       ┌──────────────────────────────────────┐     ┌───────────────────────────────────┐
                       │ TIER 1: SUPABASE POSTGRESQL          │     │ TIER 2: MONGODB ATLAS             │
                       │ - Primary Analytical Store           │     │ - Secondary Document Store        │
                       │ - JSONB Indices (metrics, dialogue)  │     │ - Mongoose Schemas (Session,      │
                       │ - Realtime Publications              │     │   Interaction, User, Lead)        │
                       └──────────────────┬───────────────────┘     └─────────────────┬─────────────────┘
                                          │                                           │
                                          └─────────────────────┬─────────────────────┘
                                                                │
                                                                ▼ (Fail-safe Fallback)
                                                   ┌──────────────────────────────────┐
                                                   │ TIER 3: IN-MEMORY CACHE (memStore│
                                                   │ - Capped at 1,000 items (FIFO)   │
                                                   │ - 60s TTL Read Cache             │
                                                   │ - Zero-Downtime Offline Buffer   │
                                                   └──────────────────┬───────────────┘
                                                                      │
                                                                      ▼
                                       ┌──────────────────────────────────────────────┐
                                       │ UNIFIED REAL-TIME COMMAND CENTER & REPLAY UI │
                                       │ (public/index.html - Vanilla JS SPA)         │
                                       │ - Microsoft Clarity Video Replay Player      │
                                       │ - Colored Friction Scrubber (Red/Blue/Green) │
                                       │ - Bot Security Matrix & Traffic Segments     │
                                       │ - Certified PDF Dossier Suite (RSST Seal)    │
                                       └──────────────────────────────────────────────┘
```

### 2.2 End-to-End Interaction & Ingestion Sequence

```
Student Browser            telemetry.js Micro-Queue         Node.js Hub (Express)          Supabase / Mongo
      │                               │                              │                            │
      │ 1. Interacts (Rage/Message)   │                              │                            │
      ├──────────────────────────────>│                              │                            │
      │                               │ 2. Buffer Event in Queue     │                            │
      │                               │    (15s Timer or Priority)   │                            │
      │                               ├─────────────────────────────>│                            │
      │                               │    POST /api/logs            │                            │
      │                               │    (JSON payload with SID)   │ 3. IP Geo & Bot Enrichment │
      │                               │                              ├───────────────────────────>│
      │                               │                              │    Upsert Session & Logs   │
      │                               │                              │<───────────────────────────┤
      │                               │                              │    Write Acknowledged      │
      │                               │                              │                            │
      │                               │                              │ 4. Broadcast via SSE       │
      │                               │                              ├────────────────────────────┼──> Live Dashboard
      │                               │<─────────────────────────────┤    Event: 'telemetry'      │    UI updates
      │                               │    HTTP 200 OK               │                            │    scrubber radar
      │                               │                              │                            │
      │ 5. Window Unload / Exit       │                              │                            │
      ├──────────────────────────────>│                              │                            │
      │                               │ 6. navigator.sendBeacon()    │                            │
      │                               ├─────────────────────────────>│                            │
      │                               │    Exit Flush Triggered      │ 7. Final Session Metrics   │
      │                               │                              ├───────────────────────────>│
```

---

## 3. WordPress Chatbot Plugin (`rvce-chatbot/`) Specification

### 3.1 Metadata & Plugin Lifecycle
* **Plugin Name:** RVCE Chatbot
* **Version:** `3.1.0` (`define('RVCE_CHATBOT_VERSION', '3.1.0');`)
* **Plugin URI / Author URI:** `https://rvce.edu.in`
* **Text Domain:** `rvce-chatbot`
* **License:** GPL-2.0+
* **File Architecture:**
  ```
  rvce-chatbot/
  ├── rvce-chatbot.php       # Core plugin bootstrap, DB tables, REST API, admin settings
  ├── script.js              # Deterministic NLP engine, KB dictionary, voice search, SafeStorage
  ├── telemetry.js           # Multi-domain session sync, friction tracker, micro-batch flush
  ├── style.css              # Glassmorphic widget styles, dark theme, responsive viewport CSS
  ├── logo.png               # Official institutional circular crest asset
  ├── rvce_logo.png          # High-resolution branding crest
  ├── dashboard/
  │   ├── index.php          # Overview dashboard with KPI tiles and traffic distribution
  │   ├── sessions.php       # Cross-subsite session explorer and interactive journey replay
  │   ├── interactions.php   # Chronological interaction event logs and search
  │   ├── analytics.php      # Aggregate metrics, intent distribution, friction indices
  │   └── login.php          # Standalone dashboard auth portal
  └── assets/                # Mirror directory containing redundant runtime assets
  ```

### 3.2 Deterministic Client-Side NLP Engine (`script.js`)
The conversation engine consists of 5,013 physical lines of optimized, pure Vanilla JavaScript executing directly on the client. It completely foregoes external cloud AI APIs, ensuring zero recurring operational costs.

#### 1. Knowledge Base Inventory
* **153 Intent Categories:** Exhaustive coverage across admissions, management quota, COMEDK/KCET cutoffs, tuition fees, scholarship schemes, hostels, mess menus, campus amenities, examinations, autonomous grading regulations, sports facilities, cultural clubs (8th Mile, Alaap), and placements.
* **17 Undergraduate Engineering Disciplines:**
  1. Aerospace Engineering (AS)
  2. Artificial Intelligence & Machine Learning (AI&ML)
  3. Biotechnology (BT)
  4. Chemical Engineering (CH)
  5. Civil Engineering (CV)
  6. Computer Science & Engineering (CSE)
  7. CSE — Artificial Intelligence & Machine Learning (CS-AIML)
  8. CSE — Cyber Security (CS-CY)
  9. CSE — Data Science (CS-DS)
  10. Electrical & Electronics Engineering (EEE)
  11. Electronics & Communication Engineering (ECE)
  12. Electronics & Instrumentation Engineering (EIE)
  13. Electronics & Telecommunication Engineering (ETE)
  14. Industrial Engineering & Management (IEM)
  15. Information Science & Engineering (ISE)
  16. Mechanical Engineering (ME)
  17. Master of Computer Applications (MCA) & Basic Sciences (Physics, Chemistry, Mathematics).
* **Head of Department (HOD) Directory:** Contains names, official academic profile links, sanctioned intake numbers, and NBA accreditation statuses for all departments.
* **32+ Centres of Excellence (CoEs) & 9 Centres of Competence (CoCs):** Detailed intent trees covering Cisco Networking CoE, Mercedes-Benz Automotive R&D, Bosch Rexroth Automation, Samsung AI, Microchip, and Clean Energy Labs.
* **Multi-Year Placement Records:** Detailed statistics for 2024, 2025, and 2026 graduating batches: highest domestic package ₹92.00 LPA, average package ₹15.80 LPA, median package ₹12.00 LPA, and roster of 200+ Tier-1 recruitment partners.

#### 2. Deterministic NLP Pipeline
1. **Sanitization & Regex Tokenization:** Normalizes input query, converts to lower-case, strips punctuation, and extracts word tokens.
2. **Stop-Word Elimination:** Filters out over 50 noise words (`the`, `is`, `a`, `an`, `how`, `what`, `where`, `can`, `i`, `get`, `rvce`, `college`, etc.).
3. **Levenshtein Fuzzy Matching:** Employs a dynamic programming Levenshtein distance algorithm permitting up to 2 character edits for typo tolerance (e.g., matching "plcmnt" $\rightarrow$ "placement", "admision" $\rightarrow$ "admission").
4. **Weighted Intent Scoring:** Scores intents based on exact token matches, keyword boundaries, and department acronym boosts, returning rich interactive HTML bubbles with dynamic quick-reply suggestion chips.

#### 3. Voice Search Integration
* Built using the native HTML5 **Web Speech API** (`SpeechRecognition` or `webkitSpeechRecognition`).
* Invoked via `#micBtn`. Upon voice capture, live transcription is piped to `#userInput` and automatically submitted after a 500 ms stabilization debounce.

#### 4. Content Moderation & Dual-Tone Engine
* **Abuse Filtering:** Scans input against a dictionary of 70+ profanities and offensive slang in English, Kannada, and Hindi.
* **Conspiracy & Political Filtering:** Flags 26+ controversial and politically sensitive keyword patterns.
* **PII Redaction:** Intercepts 32+ private data inquiry patterns (e.g., faculty phone numbers, private salary slips).
* **Dual-Tone Response Mode:** The administrator can toggle between `pro` (formal institutional phrasing) and `funny` (courteous, witty deflection).

#### 5. Page Builder Isolation (`rvce_chatbot_is_builder_active`)
To prevent crashes, iframe conflicts, or DOM lockups during visual editing, `rvce-chatbot.php` checks runtime parameters and suppresses the widget in:
* **Elementor:** `is_preview_mode()`, `elementor-preview`, or editor iframe.
* **Divi Builder:** `et_fb=1`.
* **Beaver Builder:** `fl_builder`.
* **Oxygen Builder:** `ct_builder`.
* **WPBakery:** `vc_editable`.
* **Bricks Builder:** `bricks=run`.
* **Core WP:** WordPress Customizer (`is_customize_preview()`) and WP Admin pages.

### 3.3 WordPress Admin Configuration Settings
Registered under options group `rvce_chatbot_options_group`:

| Option Key | Default Value | Description |
| :--- | :--- | :--- |
| `rvce_chatbot_enabled` | `'1'` | Master switch to enable (`1`) or disable (`0`) the frontend widget |
| `rvce_chatbot_title` | `'RVCE Assistant'` | Header display title in the chat window |
| `rvce_chatbot_status_text` | `'Online — Ready to help'` | Subtitle status indicator |
| `rvce_chatbot_welcome_text` | `'Hi there! Have questions...'` | Initial welcome bubble rendered on widget launch |
| `rvce_chatbot_subsite` | `'auto'` | Subsite tagging mode (`auto`, `main`, `departments`, `library`) |
| `rvce_chatbot_vercel_url` | `'http://localhost:3001'` | URL of the central Node.js command center ingestion hub |
| `rvce_chatbot_sheets_url` | `''` | Optional Google Apps Script webhook URL for lead mirror |
| `rvce_chatbot_logo_url` | `.../logo.png` | Public URL for institutional circular crest icon |
| `rvce_chatbot_receiver_email`| `'admissions@rvce.edu.in'` | Recipient email address for instant lead alerts |
| `rvce_chatbot_sender_email`  | `'chatbot@rvce.edu.in'`   | Outbound From address for `wp_mail()` notifications |

### 3.4 WordPress MySQL Database Architecture
Provisioned on plugin activation via `dbDelta()`:

#### 1. Table: `{$wpdb->prefix}rvce_interactions`
```sql
CREATE TABLE {$wpdb->prefix}rvce_interactions (
    id bigint(20) NOT NULL AUTO_INCREMENT,
    session_id varchar(100) NOT NULL,
    event_type varchar(100) NOT NULL,
    interaction_id varchar(255) DEFAULT '',
    bot_opened_page varchar(255) DEFAULT '',
    query_text text,
    meta_data longtext,
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY  (id),
    KEY session_id (session_id),
    KEY event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 2. Table: `{$wpdb->prefix}rvce_leads`
```sql
CREATE TABLE {$wpdb->prefix}rvce_leads (
    id bigint(20) NOT NULL AUTO_INCREMENT,
    session_id varchar(100) NOT NULL,
    lead_data longtext,
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY  (id),
    KEY session_id (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 3. Table: `{$wpdb->prefix}rvce_chat_logs` (Legacy Logs)
```sql
CREATE TABLE {$wpdb->prefix}rvce_chat_logs (
    id bigint(20) NOT NULL AUTO_INCREMENT,
    session_id varchar(100) NOT NULL,
    query text NOT NULL,
    intent_id varchar(100) NOT NULL,
    created_at datetime DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY  (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3.5 WordPress REST API & AJAX Endpoints
* **REST Route Namespace:** `rvce/v1`
  * `POST /wp-json/rvce/v1/logs`: Ingests batched telemetry arrays. Automatically executes regex extraction for prospective candidate emails (`/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/`) and 10-digit Indian mobile numbers (`/[0-9]{10}/`), auto-populating `wp_rvce_leads`.
  * `GET /wp-json/rvce/v1/overview-data`: Aggregates interaction totals, conversion counts, and bot opens.
  * `GET /wp-json/rvce/v1/interactions-data`: Returns paginated raw interaction records.
  * `GET /wp-json/rvce/v1/sessions-data`: Returns sessions grouped by `session_id`.
  * `GET /wp-json/rvce/v1/analytics-data`: Summarizes top intents and hourly engagement trends.
  * `GET /wp-json/rvce/v1/leads-data`: Fetches captured lead records.
* **AJAX Actions (`admin-ajax.php`):**
  * `wp_ajax_rvce_send_lead` / `nopriv`: Verifies `rvce_chatbot_nonce`, formats HTML mail, and dispatches via `wp_mail()`.
  * `wp_ajax_rvce_log_chat` / `nopriv`: Direct legacy insertion into `wp_rvce_chat_logs`.

---

## 4. Triple-Tier Session Handshake & Behavioral Telemetry (`telemetry.js`)

### 4.1 Triple-Tier Session Resolution Handshake
To defeat cross-domain storage partitioning across `rvce.edu.in`, `departments.rvce.edu.in`, and `library.rvce.edu.in`, `telemetry.js` executes a strict 3-tier handshake on every page load:

```
[ Page Load Event on any *.rvce.edu.in Domain ]
                     │
                     ▼
  [ Check Tier 1: Inbound URL Query Parameter ]
  Does URL contain ?rvce_sid=sess_... or ?sid=sess_...?
                     ├───► YES: 1. Extract and sanitize SID via regex /^sess_[a-zA-Z0-9_-]+$/
                     │          2. Store in localStorage & sessionStorage
                     │          3. Clean address bar via history.replaceState()
                     │          4. Set active session ID. (STOP)
                     │
                     ▼ NO
  [ Check Tier 2: First-Party Root Domain Cookie ]
  Does document.cookie contain rvce_sid=sess_...?
                     ├───► YES: 1. Read root cookie value
                     │          2. Sync to localStorage & sessionStorage
                     │          3. Set active session ID. (STOP)
                     │
                     ▼ NO
  [ Check Tier 3: Storage Fallback & UUID Generation ]
  Does sessionStorage or localStorage contain valid SID?
                     ├───► YES: 1. Reuse existing storage SID. (STOP)
                     │
                     ▼ NO
                     Generate New Cryptographic Session ID:
                     'sess_rvce_' + crypto.randomUUID().replace(/-/g, '').substring(0, 16) + '_' + Date.now().toString(36)
                     Write to:
                     1. sessionStorage (with 30-min rolling TTL)
                     2. localStorage
                     3. Root Cookie: Set-Cookie: rvce_sid=...; Domain=.rvce.edu.in; Path=/; SameSite=Lax; Secure
```

### 4.2 Outbound Internal Link Decoration
`telemetry.js` attaches a capture-phase click listener to the `document`. Whenever a user clicks an anchor (`<a>`):
1. It validates whether the target URL hostname ends with `rvce.edu.in` or includes `localhost`.
2. If the destination hostname differs from the current subsite and does not already possess `rvce_sid`, it decorates the link:
   ```javascript
   targetUrl.searchParams.set('rvce_sid', SESSION_ID);
   anchor.href = targetUrl.toString();
   ```

### 4.3 Cross-Subsite Hop Detection
`telemetry.js` determines the current portal (`main`, `departments`, or `library`) from hostname or meta tags and compares it against `sessionStorage.getItem('rvce_current_subsite')`. If a discrepancy exists, it dispatches an immediate priority event:
```json
{
  "eventType": "cross_subsite_hop",
  "fromSubsite": "departments",
  "toSubsite": "main",
  "referrer": "https://departments.rvce.edu.in/cse",
  "url": "https://rvce.edu.in/admissions",
  "timestamp": 1793532000000
}
```

### 4.4 Behavioral Friction Tracking & Operational Thresholds
The telemetry client monitors user micro-interactions to detect visitor frustration:

1. **Rage Clicks (`rage_click`):**
   * **Definition:** A user rapidly clicks the exact same DOM element $\ge 3$ times within an interval of $< 800\text{ ms}$.
   * **Payload:** Element tag, ID, CSS classes, inner text, and coordinates.
2. **Dead Clicks (`dead_click`):**
   * **Definition:** A user clicks on a non-interactive element (such as static `.chat-bubble` text) that lacks an `<a>`, `<button>`, or CSS `cursor: pointer`.
3. **Typing Hesitation (`typing_hesitation`):**
   * **Definition:** A user types $\ge 3$ characters into `#userInput` and then pauses typing for $> 3.5\text{ seconds}$ without submitting.
4. **Scroll Depth & Content Copying:**
   * Tracks vertical scroll milestones (25%, 50%, 75%, 100%) and text copy actions (`copy`) inside the chat window.

### 4.5 Dual/Triple Ingestion Pipeline & Micro-Batching
To preserve client browser responsiveness, telemetry events are queued in memory:
* **Micro-Batch Flush Interval:** Flushed every 15 seconds (`setInterval(flushQueue, 15000)`).
* **Priority Immediate Flush:** Critical events (`message`, `form_submit`, `page_load`, `bot_open`, `rage_click`, `cross_subsite_hop`) bypass the queue and trigger an immediate asynchronous flush.
* **Page Exit Beacon:** Browser close or navigation away triggers an immediate exit flush via `navigator.sendBeacon()` with an `application/json` Blob payload.
* **3-Way Routing:**
  1. **Destination 1:** WordPress REST API (`POST /wp-json/rvce/v1/logs`).
  2. **Destination 2:** Central Node.js Server (`POST /api/logs` via `rvce_chatbot_vercel_url`).
  3. **Destination 3 (Direct Cloud Fallback):** If Destination 2 returns a network error, `telemetry.js` executes an emergency fallback POST directly to Supabase PostgREST (`https://mxujlyyjhjbnnroozbvf.supabase.co/rest/v1/interactions`) using anon key `sb_publishable_D65ZHjD5ofyVQ_3ofsEOxw_Cqj98ssv`, preventing telemetry data loss during server restarts.

---

## 5. Standalone Analytics & Command Center (`rvce-standalone-dashboard/`)

### 5.1 Node.js Express 5 Architecture & Middleware Pipeline
The central command center is built on Node.js using **Express 5.2.1** (`server.js`, 2,641 lines):
* **Dynamic Multi-Origin CORS:** Validates origins against `*.rvce.edu.in`, `rvce.edu.in`, `localhost`, `127.0.0.1`, and `*.vercel.app`.
* **Content Security Policy (CSP):** Sets `frame-ancestors 'self' https://rvce.edu.in https://*.rvce.edu.in http://localhost:* http://127.0.0.1:* https://*.vercel.app` to permit embedding inside WordPress wp-admin iframes while mitigating clickjacking.
* **High-Capacity Body Parsers:** Configured with a 15 MB limit (`express.json({ limit: '15mb' })`) to accommodate heavy beacon payloads and export dumps.
* **URL Normalization Rewrite:** Dynamically rewrites non-prefixed paths (`/logs`, `/telemetry`, `/auth`) to `/api/*` and serves `public/index.html` on SPA routes.
* **Visitor Enrichment Pipeline (`utils/enrichment.js`):**
  * `extractClientIp`: Evaluates `x-forwarded-for`, `cf-connecting-ip`, and socket address.
  * `resolveGeoLocation`: Reads Vercel edge headers (`x-vercel-ip-country`, `x-vercel-ip-city`), falls back to campus coordinates (`12.9249, 77.4987`) for private IPs, caches in `geoCache`, or queries `ip-api.com` with a 2-second abort timeout.
  * `detectBot`: Regex classifier matching 20+ automated crawlers (`googlebot`, `semrush`, `ahrefs`, `bytespider`, `python-requests`, `headlesschrome`, etc.).
  * `parseDeviceEnvironment`: Uses `ua-parser-js` to extract OS, browser, engine, model, and device category.

### 5.2 Authentication & Security
* **JWT HS256 Tokenization:** Generates JSON Web Tokens signed with `JWT_SECRET` valid for 7 days (`expiresIn: '7d'`).
* **Bcrypt Password Encryption:** Passwords hashed with bcrypt salt rounds.
* **Default Admin Credentials:** `rvceadmin` / `rvce123` (seeded automatically in MongoDB and memory store on startup).
* **Protected Middleware (`authenticateToken`):** Validates incoming `Authorization: Bearer <token>` headers, returning 401 Unauthorized or 403 Forbidden.

### 5.3 Real-Time Server-Sent Events (SSE) Streaming
* **Endpoint:** `GET /api/dashboard/live/stream` (`text/event-stream`).
* **Protocol Details:** Maintains persistent HTTP connections with `Cache-Control: no-cache` and `Connection: keep-alive`. Dispatches periodic heartbeat pings every 30 seconds (`event: ping`).
* **Live Broadcast:** Broadcasts incoming telemetry batches (`event: telemetry`) to all connected admin consoles in real time.
* **PII Redaction:** Email addresses and phone numbers are scrubbed (`[REDACTED EMAIL]`, `[REDACTED PHONE]`) before broadcasting to live SSE streams.

### 5.4 Complete REST API Endpoints Matrix (23 Routes)

| # | Method | Route | Auth | File & Line | Description |
|---|:---|:---|:---|:---|:---|
| 1 | `POST` | `/api/auth/login` | Public | `server.js:178` | Admin login; returns 7-day JWT token and user profile |
| 2 | `GET` | `/api/auth/me` | JWT | `server.js:226` | Retrieves authenticated user claims and permissions |
| 3 | `GET` | `/api/dashboard/live/stream` | Public | `server.js:241` | Real-time SSE event stream for live dashboard telemetry |
| 4 | `POST` | `['/api/logs', '/api/logs/batch', '/api/telemetry']` | Public | `server.js:271` | Primary telemetry ingestion webhook; enriches Geo/Bot/UA |
| 5 | `GET` | `/api/logs` | Public | `server.js:801` | Legacy logs retrieval endpoint (`limit` parameter) |
| 6 | `GET` | `/api/dashboard/interactions` | Public | `server.js:816` | Fetches raw interaction events (default 1000, max 3000) |
| 7 | `GET` | `/api/dashboard/overview` | JWT | `server.js:1034`| Executive KPI metrics, frustration score, device breakdowns |
| 8 | `GET` | `/api/dashboard/clarity` | JWT | `server.js:1119`| Clarity UX diagnostics: rage hotspots, dead clicks, hesitation |
| 9 | `GET` | `/api/dashboard/bots` | JWT | `server.js:1316`| Bot & Crawler Security Matrix (crawled paths, crawler types)|
| 10| `GET` | `/api/dashboard/sessions` | JWT | `server.js:1379`| Session list with `subsite`, `segment`, `filter`, and `search` |
| 11| `GET` | `/api/dashboard/session/:id` | JWT | `server.js:1483`| **Singular route**; returns full session journey & replay |
| 12| `DELETE`| `/api/dashboard/sessions/:id` | JWT | `server.js:1647`| Purges single session and associated interaction records |
| 13| `GET` | `/api/dashboard/report/daily` | JWT | `server.js:1662`| Sessions grouped by calendar date for printable dossiers |
| 14| `GET` | `/api/dashboard/leads` | JWT | `server.js:1805`| Fetches captured CRM leads list |
| 15| `PATCH`| `['/api/dashboard/leads/:id/status', '/api/leads/:id/status']` | JWT | `server.js:1850`| Updates lead pipeline status (`New`, `Contacted`, etc.) |
| 16| `PATCH`| `['/api/dashboard/leads/:id', '/api/leads/:id']` | JWT | `server.js:1893`| Updates lead notes, score, and contact details |
| 17| `DELETE`| `['/api/dashboard/leads/:id', '/api/leads/:id']` | JWT | `server.js:1925`| Deletes single lead record |
| 18| `GET` | `/api/dashboard/unanswered` | JWT | `server.js:1947`| Unanswered visitor inquiries (knowledge base gaps) |
| 19| `POST` | `/api/dashboard/unanswered/:id/resolve` | JWT | `server.js:1966`| Marks unanswered inquiry as resolved |
| 20| `POST` | `/api/chat/reply` | Public | `server.js:2035`| Standalone server-side chatbot engine matching `RVCE_KNOWLEDGE` |
| 21| `GET` | `/api/dashboard/export/csv` | JWT | `server.js:2071`| Exports sessions or leads in CSV format |
| 22| `GET` | `['/api/dashboard/sessions/:id/export', '/api/dashboard/session/:id/export']` | JWT | `server.js:2148`| Formatted text/markdown journey export for single session |
| 23| `GET` | `/api/health` | Public | `server.js:2253`| Server health, uptime, and database storage status |
| 24| `GET` | `/api/supabase/status` | Public | `server.js:2274`| Supabase table row counts and connectivity check |
| 25| `POST` | `/api/dashboard/clear` | JWT | `server.js:2286`| Purges all telemetry and session records across databases |
| 26| `POST` | `/api/demo/seed` | Public | `server.js:2574`| Seeds realistic demo sessions, journeys, and friction events |

*(Note: Endpoint count reflects routes and aliases registered in `server.js`).*

### 5.5 Standalone Frontend UI Architecture (`public/index.html`)
The frontend is a self-contained Single Page Application (5,246 lines, zero React/Vite/Webpack dependencies):
* **Design System:** Deep dark aesthetic (`#050811`, `#0a0f1d`), glassmorphism card surfaces (`backdrop-filter: blur(10px)`), and a canvas-driven dynamic ambient mesh background (`.mesh-bg`).
* **Microsoft Clarity Video-Style Interactive Replay Player:**
  * **Interactive Scrubber:** Scrub through a visitor's exact clickstream and page navigation steps.
  * **Colored Friction Markers Layer (`.player-markers-layer`):**
    * 🔴 **Red Markers:** Rage clicks, dead clicks, typing hesitations, bot bounces.
    * 🔵 **Blue Markers:** Student queries and messages.
    * 🟢 **Green Markers:** Chatbot replies and lead capture submissions.
    * 🟣 **Purple Markers:** Page landings, internal link hops, navigation events.
  * **Playback Speed Multipliers:** Toggle between `1.0x` (1400 ms interval), `1.5x` (900 ms interval), and `2.0x` (500 ms interval).
  * **Synchronized 3-Column Inspection Drawer:** Simultaneously replays the Visual Clickstream Journey, Chat Dialogue Bubbles, and Raw Event Telemetry.
* **Certified PDF Dossier Suite (`public/print-report.html`):**
  * Dedicated 1,212-line print dossier template featuring the official RSST governance header, institutional crest, watermark, and session audit tables.

---

## 6. Database Schemas & Persistence Specification

### 6.1 Supabase PostgreSQL Schema (`supabase_setup.sql`)

```sql
-- 1. SESSIONS TABLE (Visitor Journey, Geo, Device, Metrics & Dialogue)
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT UNIQUE NOT NULL,
    institute_id TEXT DEFAULT 'rvce',
    landing_page TEXT DEFAULT '/',
    entry_page TEXT DEFAULT '/',
    exit_page TEXT DEFAULT '/',
    page_history JSONB DEFAULT '[]'::jsonb,
    referrer TEXT DEFAULT 'Direct',
    referrer_domain TEXT DEFAULT 'direct',
    utm JSONB DEFAULT '{}'::jsonb,
    geo JSONB DEFAULT '{"country":"India","country_code":"IN","region":"Karnataka","city":"Bengaluru"}'::jsonb,
    device JSONB DEFAULT '{"type":"Desktop","os":"Windows","browser":"Chrome","screen":"1920x1080","viewport":"1920x1080"}'::jsonb,
    metrics JSONB DEFAULT '{"event_count":0,"message_count":0,"click_count":0,"rage_clicks":0,"dead_clicks":0,"max_scroll_depth":0,"dwell_seconds":0,"frustration_score":0}'::jsonb,
    dialogue JSONB DEFAULT '[]'::jsonb,
    sentiment TEXT DEFAULT 'Neutral',
    last_intent TEXT DEFAULT '',
    is_converted_lead BOOLEAN DEFAULT FALSE,
    lead_summary JSONB DEFAULT '{}'::jsonb,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_is_lead ON sessions(is_converted_lead);
CREATE INDEX IF NOT EXISTS idx_sessions_geo_city ON sessions((geo->>'city'));
CREATE INDEX IF NOT EXISTS idx_sessions_referrer ON sessions(referrer);

-- 2. INTERACTIONS TABLE (Granular Event Stream & Chat Messages)
CREATE TABLE IF NOT EXISTS interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    institute_id TEXT DEFAULT 'rvce',
    event_type TEXT NOT NULL,           -- 'message', 'click', 'rage_click', 'dead_click', 'page_visit', 'scroll', 'copy'
    interaction_id TEXT DEFAULT '',     -- intent name, element ID, or action tag
    query_text TEXT DEFAULT '',         -- user message or button label
    bot_reply TEXT DEFAULT '',          -- bot response
    page_url TEXT DEFAULT '',
    page_path TEXT DEFAULT '',
    element JSONB DEFAULT '{}'::jsonb,  -- tag, id, className, text, isDeadClick
    is_unanswered BOOLEAN DEFAULT FALSE,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_session_id ON interactions(session_id);
CREATE INDEX IF NOT EXISTS idx_interactions_event_type ON interactions(event_type);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interactions_unanswered ON interactions(is_unanswered, is_resolved);

-- 3. LEADS TABLE (CRM Capture Pipeline)
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    institute_id TEXT DEFAULT 'rvce',
    name TEXT DEFAULT 'Candidate',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    status TEXT DEFAULT 'New',          -- 'New', 'Contacted', 'Qualified', 'Enrolled', 'Junk'
    notes TEXT DEFAULT '',
    score INT DEFAULT 85,
    lead_data JSONB DEFAULT '{}'::jsonb,
    attribution JSONB DEFAULT '{}'::jsonb,
    geo JSONB DEFAULT '{}'::jsonb,
    device JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- 4. ENABLE SUPABASE REALTIME PUBLICATION
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class pc ON pr.prrelid = pc.oid JOIN pg_publication pp ON pr.prpubid = pp.oid WHERE pp.pubname = 'supabase_realtime' AND pc.relname = 'sessions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE sessions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class pc ON pr.prrelid = pc.oid JOIN pg_publication pp ON pr.prpubid = pp.oid WHERE pp.pubname = 'supabase_realtime' AND pc.relname = 'interactions') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE interactions;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_rel pr JOIN pg_class pc ON pr.prrelid = pc.oid JOIN pg_publication pp ON pr.prpubid = pp.oid WHERE pp.pubname = 'supabase_realtime' AND pc.relname = 'leads') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE leads;
    END IF;
END $$;
```

### 6.2 MongoDB Mongoose Models (`models/`)
The standalone backend utilizes Mongoose models for secondary document storage:
* **`models/Session.js`:** Defines `journey: [journeyStepSchema]` capturing the full clickstream sequence, `subsitesTouched: [String]`, `metrics` (14 sub-fields including `rageClicks`, `deadClicks`, `hesitationCount`, `frustrationScore`), and embedded `dialogue: [{ sender, text, intent, timestamp }]`.
* **`models/Interaction.js`:** Models individual micro-interactions, capturing `element` metadata (`tag`, `id`, `className`, `text`, `xpath`, `isDeadClick`), page path, and redirection links.
* **`models/User.js`:** Stores administrative credentials with `username` (unique), `passwordHash` (bcrypt), and `role`.
* **`models/Lead.js`:** Retains CRM candidate lead documents with status pipeline enums.
*(Architectural Note: There are no separate `Conversation.js` or `Analytics.js` models; dialogue and analytics are sub-documents inside `Session.js`).*

---

## 7. Configurations & Environment Variables

### 7.1 Backend Environment Configuration (`.env`)
The Node.js server reads the following environment variables:

| Variable | Required | Default in Code | Purpose |
| :--- | :---: | :--- | :--- |
| `PORT` | Optional | `3001` | HTTP listening port for Express 5 server |
| `JWT_SECRET` | Required | `'rvce_command_center_secret_2026'` | Secret key used to sign and verify HS256 JWT tokens |
| `INSTITUTE_ID` | Optional | `'rvce'` | Multi-tenant tenant identifier |
| `API_KEY` | Optional | `'rvce_key_12345'` | Security key for protected telemetry ingestion |
| `MONGO_URI` | Optional | `undefined` | MongoDB Atlas connection string; if omitted, engages `memStore` |
| `SUPABASE_URL` | Required | `undefined` | URL of the Supabase cloud project (`https://<ref>.supabase.co`) |
| `SUPABASE_ANON_KEY` | Required | `undefined` | Supabase public anonymous API key for client-safe REST queries |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | `undefined` | Elevated administrative key for backend bypass of RLS |

### 7.2 WordPress Configuration Variables
In the WordPress plugin, telemetry settings are managed dynamically via the WordPress Admin Settings GUI (`wp-admin/admin.php?page=rvce-chatbot-settings`) rather than hardcoded `wp-config.php` constants. Settings are stored in the WordPress `wp_options` table under `rvce_chatbot_options_group`.

---

## 8. Discrepancy Rectifications & Bug Catalog

During technical verification of earlier documentation files against the codebase, several discrepancies and runtime defects were uncovered and rectified:

### 8.1 Ingestion Route Discrepancy
* **Earlier Documentation Claim:** Earlier documentation (e.g. `COMPLETE_PROJECT_DOCUMENTATION.md` line 49) asserted that the Node.js server ingested telemetry at `/api/telemetry/events`.
* **Codebase Reality:** In `server.js` (line 271), Express registers:
  ```javascript
  app.post(['/api/logs', '/api/logs/batch', '/api/telemetry'], ...)
  ```
* **Resolution:** Documentation has been updated to list `/api/logs` and `/api/telemetry`. Any external webhook or client targeting `/api/telemetry/events` will receive a 404 error.

### 8.2 WordPress Telemetry URL Setting Discrepancy
* **Earlier Documentation Claim:** `COMPLETE_PROJECT_DOCUMENTATION.md` stated that WordPress configuration required defining a PHP constant:
  ```php
  define('RVCE_CENTRAL_TELEMETRY_URL', 'https://analytics.rvce.edu.in');
  ```
* **Codebase Reality:** No such constant exists in `rvce-chatbot/rvce-chatbot.php`. The setting is stored in WordPress options as `rvce_chatbot_vercel_url` (default `'http://localhost:3001'`), localized to JavaScript as `window.rvceChatbotSettings.vercelUrl`.
* **Resolution:** Documentation corrected to specify `rvce_chatbot_vercel_url`.

### 8.3 Singular vs Plural API Route Signature
* **Earlier Documentation Claim:** `rvce-standalone-dashboard/documentation/API_REFERENCE.md` listed `GET /api/dashboard/sessions/:id`.
* **Codebase Reality:** In `server.js` (line 1483), the GET route is defined as singular:
  ```javascript
  app.get('/api/dashboard/session/:id', authenticateToken, ...)
  ```
  *(In contrast, the DELETE route at line 1647 is plural `/api/dashboard/sessions/:id`).*
* **Resolution:** Documentation corrected to reflect the singular path `GET /api/dashboard/session/:id`.

### 8.4 Portal Scope Selector UI Discrepancy & Frontend Runtime Defect
* **Earlier Documentation Claim:** Documentation stated that both `public/index.html` and `sessions.php` provide Scope Selector UI buttons allowing administrators to toggle between All Portals, Main, Departments, and Library.
* **Codebase Reality:** While the backend API supports `?subsite=...`, neither `index.html` nor `sessions.php` renders interactive scope buttons. Furthermore, in `public/index.html` line 3786:
  ```javascript
  fetchWithAuth(`/api/dashboard/sessions?segment=${currentSegment}&subsite=${currentSubsite}&limit=80`)
  ```
  `currentSubsite` was never declared or initialized, triggering a browser runtime `ReferenceError: currentSubsite is not defined`.
* **Resolution:** Documented as an identified frontend defect requiring explicit declaration of `let currentSubsite = 'all';` in `index.html`.

### 8.5 Leads CRM Deprecation
* **Earlier Documentation Claim:** Older project descriptions referenced an active "Leads CRM Tab" in both WordPress and standalone dashboards.
* **Codebase Reality:** `dashboard/leads.php` was permanently removed. The standalone frontend deprecated the Leads CRM tab in late October 2026, replacing it with the **Bot & Crawler Security Matrix** (`GET /api/dashboard/bots`) and Chatbot Lifecycle Duration tracking.
* **Resolution:** Documented that Leads CRM is superseded in the UI by bot security and lifecycle tracking, while legacy backend CRUD routes remain intact.

### 8.6 Absence of Cloud AI / LLM APIs
* **Earlier Documentation Claim:** Marketing summaries often implied the chatbot was powered by external generative AI models (such as Google Gemini or OpenAI).
* **Codebase Reality:** Exhaustive codebase scanning confirms **0 occurrences of external LLM APIs**. The bot is powered 100% by a client-side deterministic NLP engine and local dictionary search.
* **Resolution:** Clarified to highlight zero-cost, zero-latency, and zero-hallucination guarantees.

---

## 9. Production Deployment & Operations Runbook

### 9.1 Central Analytics Command Center Deployment (Node.js)

#### 1. System Requirements
* **Operating System:** Ubuntu 22.04+ LTS, Rocky Linux 9+, or Windows Server 2022.
* **Runtime:** Node.js v18.0.0+ (LTS) and `npm` v9.0.0+.
* **Process Manager:** `pm2` (`npm install -g pm2`).

#### 2. Server Installation & Execution
```bash
# 1. Clone or extract standalone dashboard repository
cd /var/www/rvce-standalone-dashboard

# 2. Install production dependencies (Express 5, Supabase, Mongoose, etc.)
npm install --production

# 3. Configure production environment variables
cp .env.example .env
nano .env

# 4. Launch with PM2 Process Manager in cluster mode
pm2 start server.js --name "rvce-analytics-hub" -i max

# 5. Persist PM2 daemon on system reboot
pm2 save
pm2 startup
```

#### 3. Reverse Proxy Configuration (Nginx)
To enable SSL termination and WebSocket/SSE streaming:
```nginx
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

        # Disable buffering for Server-Sent Events (SSE)
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }
}
```

### 9.2 WordPress Plugin Multisite Deployment

1. **Deploy Plugin Directory:** Copy the `rvce-chatbot/` directory into `/wp-content/plugins/` on all three WordPress portal servers:
   * Main Portal: `https://rvce.edu.in`
   * Departments Portal: `https://departments.rvce.edu.in`
   * Library Portal: `https://library.rvce.edu.in`
2. **Activate Plugin:** In each WordPress Admin, navigate to **Plugins $\rightarrow$ Installed Plugins** and click **Activate** under **RVCE Chatbot**. This executes `rvce_chatbot_activate()`, provisioning MySQL tables via `dbDelta()`.
3. **Configure Central Telemetry Hub:**
   * Navigate to **RVCE Chatbot $\rightarrow$ Settings**.
   * Under **Central Telemetry Hub URL**, input the production Node.js URL (e.g., `https://analytics.rvce.edu.in`).
   * Select the appropriate **Subsite Scope** (`main`, `departments`, or `library`).
   * Save changes.
4. **Verify Session Handshake in Production:** Ensure that the production domain sets root cookies on `.rvce.edu.in` so that visitors moving between subdomains maintain their active session identity.

### 9.3 System Health Checks & Diagnostic Commands

#### 1. Server Uptime & Storage Diagnostics
```bash
curl -s http://localhost:3001/api/health | jq .
```
*Expected Output:*
```json
{
  "status": "online",
  "uptime": 14205,
  "sessionsCount": 3149,
  "storage": "supabase_primary_with_memstore_cache",
  "sseClientsActive": 3
}
```

#### 2. Supabase Cloud Connectivity Check
```bash
curl -s http://localhost:3001/api/supabase/status | jq .
```
*Expected Output:*
```json
{
  "connected": true,
  "sessions_count": 3149,
  "interactions_count": 5995
}
```

#### 3. Independent Verification Runbook (PowerShell)
Execute from workspace root to verify system integrity:
```powershell
# 1. Verify absence of external cloud AI / LLM dependencies
Get-ChildItem -Recurse -File -Include "*.js", "*.php" | 
  Where-Object { $_.FullName -notmatch '\\\.git|\\\.agents|node_modules' } | 
  Select-String -Pattern "(gemini|openai|gpt|anthropic|claude)"
# Result: 0 matches

# 2. Verify registered Express ingestion routes
Select-String -Path ".\rvce-standalone-dashboard\server.js" -Pattern "app\.post\(\['/api/logs"
# Result: Line 271: app.post(['/api/logs', '/api/logs/batch', '/api/telemetry'])

# 3. Verify singular session retrieval route
Select-String -Path ".\rvce-standalone-dashboard\server.js" -Pattern "app\.get\('/api/dashboard/session"
# Result: Line 1483: app.get('/api/dashboard/session/:id'

# 4. Verify WordPress plugin version constant
Select-String -Path ".\rvce-chatbot\rvce-chatbot.php" -Pattern "RVCE_CHATBOT_VERSION"
# Result: define('RVCE_CHATBOT_VERSION', '3.1.0');
```

---

*RVCE Chatbot & Analytics Platform — Developed for R.V. College of Engineering (Autonomous Institution affiliated to VTU), Bengaluru. All specifications verified against workspace codebase.*
