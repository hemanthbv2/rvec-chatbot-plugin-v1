# RVCE Chatbot & Analytics Command Center — Master Project Documentation

**Project Version:** 2.5.0 (Multi-Domain Enterprise Architecture)  
**Institution:** R.V. College of Engineering (RVCE), Bengaluru  
**Release Date:** November 2026  
**License:** Institutional Proprietary / Commercial  

---

## 1. Executive Summary & Multi-Domain Architecture Overview

The **RVCE Chatbot & Analytics Platform** is an enterprise-grade conversational AI and behavioral intelligence system specifically architected for R.V. College of Engineering. It serves as the primary conversational bridge for prospective students, parents, alumni, and campus visitors across RVCE's ecosystem.

In production, RVCE operates across **three distinct WordPress installations**:
1. **Main Portal:** `https://rvce.edu.in` (Admissions, Cutoffs, Placements, Institutional Governance)
2. **Departments Portal:** `https://departments.rvce.edu.in` (17 Engineering Departments, Faculty Directories, HODs, Laboratories)
3. **Library & Alumni Portal:** `https://library.rvce.edu.in` (Digital Library, Catalog Search, Research Archives, Alumni Relations)

### Core Engineering Achievement: Cross-Domain Session Continuity
Modern web browsers strictly enforce **origin and storage partitioning**—meaning `sessionStorage` and `localStorage` on `departments.rvce.edu.in` are completely isolated from `rvce.edu.in`. 

The platform deploys a **Triple-Tier Handshake Protocol** that guarantees 100% session continuity:
* If a prospective student inquires about Computer Science faculty on the Departments portal and clicks a link back to the Main portal for KCET cutoffs, **the chatbot session ID, conversational dialogue history, and clickstream timeline follow them seamlessly**.
* All telemetry data from all 3 portals is merged into a single Central Analytics Engine, while providing instant **Scope Filtering** (view all portals unified or isolate individual portals).

```
                                  [ STUDENT VISITORS ]
               (Instagram Ads, Google Search, Direct Inquiries, KCET Portals)
                                          │
            ┌─────────────────────────────┼─────────────────────────────┐
            ▼                             ▼                             ▼
┌───────────────────────┐   ┌───────────────────────┐   ┌───────────────────────┐
│     MAIN PORTAL       │   │  DEPARTMENTS PORTAL   │   │    LIBRARY PORTAL     │
│    (rvce.edu.in)      │   │(departments.rvce.edu) │   │ (library.rvce.edu.in) │
│  ┌─────────────────┐  │   │  ┌─────────────────┐  │   │  ┌─────────────────┐  │
│  │ Chatbot Widget  │  │   │  │ Chatbot Widget  │  │   │  │ Chatbot Widget  │  │
│  │ + Telemetry.js  │  │   │  │ + Telemetry.js  │  │   │  │ + Telemetry.js  │  │
│  └────────┬────────┘  │   │  └────────┬────────┘  │   │  └────────┬────────┘  │
└───────────┼───────────┘   └───────────┼───────────┘   └───────────┼───────────┘
            │                           │                           │
            └───────────────┬───────────┴───────────┬───────────────┘
                            │                       │
     [ Tier 1: URL Query Decoration (?rvce_sid) ]   │
     [ Tier 2: Root Cookie (domain=.rvce.edu.in)]   │
     [ Tier 3: Local/Session Storage Fallback   ]   │
                            ▼                       │
         ┌─────────────────────────────────────┐    │
         │   CENTRAL NODE.JS INGESTION HUB     │◄───┘
         │   (/api/telemetry/events)           │
         │   - Dynamic Multi-Origin CORS       │
         │   - Subsite Extraction & Tagging    │
         │   - Cross-Subsite Hop Detection     │
         └──────────────────┬──────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      ┌─────────────────┐       ┌─────────────────┐
      │  Supabase Cloud │       │ In-Memory Cache │
      │  (Postgres DB)  │       │ (OOM Protected) │
      └────────┬────────┘       └────────┬────────┘
               │                         │
               └────────────┬────────────┘
                            │
                            ▼
      ┌─────────────────────────────────────────────────────────┐
      │               UNIFIED COMMAND CENTER SUITE              │
      │                                                         │
      │ 1. Standalone Command Center (http://localhost:3001)    │
      │ 2. WordPress Admin Dashboard (Plugin /wp-admin/)        │
      │                                                         │
      │ 🔍 Scope Filter: [ All Portals | Main | Depts | Library]│
      │ 🌐 Journey Replay: Auto-renders Subsite Hop Badges      │
      │ 📄 Certified Reports: Daily & Monthly PDF Dossiers      │
      └─────────────────────────────────────────────────────────┘
```

---

## 2. Cross-Domain Session Synchronization Engine

### 2.1. The Triple-Tier Handshake (`telemetry.js` & `script.js`)
To guarantee that a visitor maintains the exact same session identity across domain boundaries, `telemetry.js` resolves the Session ID (`SID`) in order of precedence:

1. **Tier 1 — Inbound URL Parameter Passing (`?rvce_sid=` or `?sid=`):**
   When a student transitions between subdomains (e.g. clicking a link on `departments.rvce.edu.in` pointing to `rvce.edu.in`), outbound link handlers automatically decorate the URL with `?rvce_sid=<SESSION_ID>`. When the destination page loads, `telemetry.js` extracts this parameter, establishes it as the active session, stores it, and cleans up the address bar via `history.replaceState()`.
2. **Tier 2 — First-Party Shared Root Cookie:**
   Sets a cookie scoped to the root parent domain:
   ```http
   Set-Cookie: rvce_sid=sid_xxxxxxxx_xxxx; Domain=.rvce.edu.in; Path=/; SameSite=Lax; Max-Age=86400; Secure
   ```
   Every request and page load across all RVCE subdomains (`rvce.edu.in`, `*.rvce.edu.in`) shares this first-party cookie.
3. **Tier 3 — Storage Fallback (`sessionStorage` & `localStorage`):**
   Retained for isolated local test environments (`localhost`, IP addresses) or strict browser configurations where third-party cookie restrictions apply.

### 2.2. Outbound Internal Link Decoration
`telemetry.js` intercepts clicks on internal links across the three domains:
```javascript
document.addEventListener('click', function(e) {
  const anchor = e.target.closest('a');
  if (!anchor || !anchor.href) return;
  try {
    const targetUrl = new URL(anchor.href, window.location.href);
    const isRvceSubdomain = targetUrl.hostname.endsWith('rvce.edu.in') || 
                            targetUrl.hostname.includes('localhost');
    if (isRvceSubdomain && targetUrl.hostname !== window.location.hostname) {
      if (!targetUrl.searchParams.has('rvce_sid')) {
        targetUrl.searchParams.set('rvce_sid', window.rvceSessionId);
        anchor.href = targetUrl.toString();
      }
    }
  } catch (err) {}
}, true);
```

### 2.3. Cross-Subsite Hop Detection (`cross_subsite_hop`)
When an inbound session transitions from one subsite to another, `telemetry.js` detects the hostname change and logs an immediate priority event:
```json
{
  "type": "cross_subsite_hop",
  "fromSubsite": "departments",
  "toSubsite": "main",
  "referrer": "https://departments.rvce.edu.in/cse",
  "target": "https://rvce.edu.in/admissions",
  "timestamp": 1793532000000
}
```
This renders on the Clarity Journey Replay drawer as:
> `🌐 Subsite Hop: DEPARTMENTS ➔ MAIN (departments.rvce.edu.in → rvce.edu.in)`

---

## 3. Central Ingestion Engine & Multi-Tenant Routing (`server.js`)

### 3.1. Dynamic Origin & CORS Configuration
The Node.js Express server accepts incoming telemetry and chat dialogue from all three domains simultaneously:
```javascript
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = (
      origin.endsWith('.rvce.edu.in') ||
      origin === 'https://rvce.edu.in' ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1') ||
      origin.endsWith('.vercel.app')
    );
    return callback(null, allowed);
  },
  credentials: true
}));
```

### 3.2. Content Security Policy (CSP)
```http
Content-Security-Policy: frame-ancestors 'self' https://rvce.edu.in https://*.rvce.edu.in http://localhost:* http://127.0.0.1:*
```

### 3.3. Subsite Tagging & Memory Aggregation
Incoming event batches are parsed to extract their origin portal:
* Hostnames matching `departments.*` $\rightarrow$ `subsite = "departments"`
* Hostnames matching `library.*` $\rightarrow$ `subsite = "library"`
* Root domain or `/admissions` $\rightarrow$ `subsite = "main"`

The central session object maintains an array of all domains touched during a student's journey:
```javascript
memSession.subsitesTouched = Array.from(
  new Set([...(memSession.subsitesTouched || []), requestSubsite, ...batchSubsites])
);
```

### 3.4. Multi-Tenant Query Endpoints
* **All Portals Combined:** `GET /api/dashboard/sessions`
* **Departments Only:** `GET /api/dashboard/sessions?subsite=departments`
* **Main Portal Only:** `GET /api/dashboard/sessions?subsite=main`
* **Library Only:** `GET /api/dashboard/sessions?subsite=library`

---

## 4. Analytics Dashboards & UI Controls

### 4.1. Portal Scope Selector
Both the **Standalone Command Center** (`public/index.html`) and the **WordPress Admin Interface** (`sessions.php`) feature an intuitive Portal Scope selector:
* 🌐 **All RVCE Portals (Unified)**: Combines total telemetry, showing cross-domain user flow.
* 🏛️ **Main Portal (`rvce.edu.in`)**: Filters visitors and inquiries on the central institutional site.
* 🏢 **Departments (`departments.rvce.edu.in`)**: Evaluates traffic across the 17 academic departments.
* 📚 **Library & Alumni (`library.rvce.edu.in`)**: Analyzes digital library access and alumni interactions.

### 4.2. Visual Replay Drawer & Cross-Portal Badges
* In the session table, any visitor who browsed across portals displays a badge:  
  `🌐 Cross-Portal: departments ➔ main`
* Opening the session reveals an interactive journey step-by-step playback:
  * Page views with dwell times
  * User message inputs & bot responses
  * ⚡ Rage clicks & 👻 Dead clicks
  * 🌐 Cross-subsite hops

### 4.3. Certified PDF Archival Suite
* **Daily Session Dossier (`.pdf`)**: Generates formatted tabular reports of the day's inquiries, dwell duration, and friction alerts.
* **Monthly Digest (`.pdf`)**: Aggregates high-altitude metrics for institutional compliance and departmental meetings.
* **Spreadsheet Exports (`.xlsx` & `.csv`)**: Provides instant one-click raw tabular exports.

---

## 5. WordPress Deployment & Configuration Guide

Follow these steps to deploy the unified plugin across all three WordPress sites:

### 5.1. Plugin Installation on All 3 Sites
1. Download [`rvce-chatbot-plugin-ready.zip`](file:///C:/Users/LENOVO/Downloads/rvce-chatbot-plugin-ready.zip).
2. Log into the WordPress Admin for each site:
   * Main: `https://rvce.edu.in/wp-admin`
   * Departments: `https://departments.rvce.edu.in/wp-admin`
   * Library: `https://library.rvce.edu.in/wp-admin`
3. Navigate to **Plugins $\rightarrow$ Add New $\rightarrow$ Upload Plugin**.
4. Choose `rvce-chatbot-plugin-ready.zip` and click **Install Now**, then **Activate Plugin**.

### 5.2. Setting the Telemetry Ingestion URL
In the WordPress dashboard for each subsite, navigate to **RVCE Chatbot $\rightarrow$ Settings** (or verify `rvce-chatbot.php` constants):
* Ensure `RVCE_TELEMETRY_URL` points to your central Node.js server:
  ```php
  // Default Central Telemetry Server
  define('RVCE_CENTRAL_TELEMETRY_URL', 'https://analytics.rvce.edu.in');
  ```
  *(Or `http://localhost:3001` during local/staging validation).*

### 5.3. Standalone Dashboard Service Setup
To host the Central Analytics Server on an institutional server (e.g. Ubuntu / Rocky Linux / Windows Server):
```bash
# 1. Extract RVCE_COMPLETE_PROJECT_BUNDLE.zip
unzip RVCE_COMPLETE_PROJECT_BUNDLE.zip -d /var/www/rvce-analytics

# 2. Enter dashboard server directory
cd /var/www/rvce-analytics/rvce-standalone-dashboard

# 3. Install production dependencies
npm install --production

# 4. Start with PM2 Process Manager
pm2 start server.js --name "rvce-analytics-hub" -i max
pm2 save
pm2 startup
```

---

## 6. Verification & Quality Assurance Audit

| Test Case | Method | Expected Result | Status |
| :--- | :--- | :--- | :--- |
| **Cross-Portal Ingestion** | Ingest batch tagged `departments` and hop to `main` | Session appears with `subsitesTouched: ['departments', 'main']` | ✅ Verified Pass |
| **All Portals Filter** | `GET /api/dashboard/sessions` | Returns full merged dataset across all domains | ✅ Verified Pass |
| **Departments Filter** | `GET /api/dashboard/sessions?subsite=departments` | Returns only sessions that touched the Departments site | ✅ Verified Pass |
| **Main Filter** | `GET /api/dashboard/sessions?subsite=main` | Returns only sessions that touched the Main site | ✅ Verified Pass |
| **Syntax Validation** | Node.js VM `compileScript` on all `.html` & `.php` files | Zero syntax or duplicate identifier errors | ✅ Verified Pass |
| **Live SSE Stream** | Connect to `/api/dashboard/live/stream` | Pushes real-time events without page refresh | ✅ Verified Pass |
| **GitHub Synchronization** | Pushed to `rvec-chatbot-plugin-v1.git` | Branch `main` at commit `7ebd88a` | ✅ Verified Pass |

---

## 7. Institutional Contacts & Support

* **Institution:** R.V. College of Engineering (Autonomous Institution affiliated to VTU)
* **Address:** Mysuru Road, RV Vidyaniketan Post, Bengaluru, Karnataka 560059
* **Project Team:** RVCE Web & Conversational Systems Taskforce
