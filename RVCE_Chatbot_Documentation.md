# RVCE Smart Chatbot & Multi-Portal System — Simple Explanation Guide

## 1. What is this Chatbot?
Think of this chatbot as a **virtual receptionist and digital guide** for R.V. College of Engineering. Its main job is to instantly answer questions for students, parents, and visitors. Whether someone wants to know about admissions, KCET/COMEDK cutoffs, hostel fees, placement packages, or the name of a specific department head, the bot gives them the exact answer immediately.

---

## 2. The Multi-Website Challenge & How We Solved It
RVCE runs three separate websites on WordPress:
1. **Main Website**: `rvce.edu.in` (Admissions, Cutoffs, Placements)
2. **Departments Website**: `departments.rvce.edu.in` (All 17 engineering branches & faculty)
3. **Library & Alumni Portal**: `library.rvce.edu.in` (Books, research archives, and alumni)

### The Problem
Usually, if a student opens a chatbot on the Departments website and then clicks a link to the Main website, their chat session resets, and the dashboard treats them as two completely different people.

### The Solution: "Smart Continuity"
We built a seamless connection system between the 3 sites:
* **Shared Cookie (`.rvce.edu.in`)**: The 3 sites share a safe, private first-party pass.
* **Link Passing (`?rvce_sid=...`)**: When a student clicks an internal link from Departments to Main, the chatbot automatically attaches their session ID so the other website welcomes them without forgetting their chat history.
* **Merged Dashboard**: All 3 websites send their data to **one central dashboard**. Administrators can view all visitors combined across the whole college, or click a button to view only Departments, only Main, or only Library.

---

## 3. How is it Built? (The "No-Server" Client Brain)
Most chatbots require expensive cloud AI servers and external APIs to answer routine questions. **This chatbot does not.** 
The core conversational brain and all of the college's data are packed directly into the website's code:
- **Instant Answers**: Answers appear in milliseconds without lag.
- **Zero Cost**: No recurring AI API fees or database maintenance fees for answering questions.
- **Offline Resilient**: Once the page loads, the student can ask questions even on fluctuating mobile data connections.

---

## 4. How do Visitors Use It?
The bot gives users two easy ways to get answers:
1. **Interactive Quick-Picks**: When the bot opens, it presents popular topic chips like "Placements", "Admissions", "Departments", or "Hostel Fees". Users can simply tap their way through menus without typing a single word.
2. **Natural Typing**: Visitors can type in plain English. For example, asking *"Who is the HOD of Computer Science?"*, *"What is the highest salary this year?"*, or *"Hostel fee for 2 in a room"* triggers the exact answer immediately.

---

## 5. What Does the Analytics Command Center Track?
To help college administrators and marketing teams understand visitor needs, the platform includes a real-time behavioral analytics dashboard:
* **Total Visitors & Conversations**: How many people visited and how many engaged in dialogue.
* **Journey Breadcrumbs**: See which pages visitors viewed before asking questions.
* **Friction Alerts**:
  * ⚡ **Rage Clicks**: Flags when a user taps frustratedly multiple times on an item.
  * 👻 **Dead Clicks**: Flags when a user clicks non-clickable text expecting a link.
  * ⏳ **Hesitation**: Flags when a user pauses typing, indicating confusion.
* **Certified PDF Downloads**: One-click generation of Daily and Monthly official reports for college administration.

---

## 6. How to Deploy the Plugin
The entire system is packaged into a single WordPress zip file:
1. Log in to the WordPress admin panel of each of the 3 sites (`rvce.edu.in/wp-admin`, `departments.rvce.edu.in/wp-admin`, etc.).
2. Go to **Plugins $\rightarrow$ Add New $\rightarrow$ Upload Plugin**.
3. Select `rvce-chatbot-plugin-ready.zip` and click **Activate**.
4. Both the chatbot widget on the front-end and the administrative dashboard in the back-end will activate immediately.

---

## 7. Summary
This system gives RVCE a unified, intelligent presence across all of its online properties. It delivers a fast, mobile-friendly experience for students and parents while giving college administrators clear, centralized intelligence into what visitors are looking for.
