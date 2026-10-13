# Dynamic Report User Mapping Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three real, narrated user/team/report-mapping clips to the single offline Dynamic Report HTML guide and remove all newly created demo database records after capture.

**Architecture:** A Playwright recorder drives the existing local PC02 UI and records three continuous chapters against the isolated report-test database. A renderer turns chapter events into Vietnamese Edge TTS, AAC audio and burned captions. The existing HTML builder embeds the final MP4 files and expands the textual permission map; an independent verifier exercises every embedded clip and checks cleanup evidence.

**Tech Stack:** Node.js, Playwright, Prisma/PostgreSQL, Python, edge-tts, FFmpeg, single-file HTML/CSS/JavaScript.

## Global Constraints

- Use only the isolated local database on port 55434; never create or delete production data.
- Use fresh `[DEMO]`/`demo_` identifiers and record every created database ID.
- Do not modify shared roles or real accounts.
- Record real UI interaction and real login; do not fabricate modal or permission results.
- Native browser prompts absent from headless video must be represented by an explicit truthful caption.
- Delete only IDs recorded by this run and verify their absence after capture.
- Final delivery remains one offline HTML file containing all video, narration, captions and guide text.

---

### Task 1: Recorder and cleanup contract

**Files:**
- Create: `work/user-mapping-v3/record-user-mapping.cjs`
- Create: `work/user-mapping-v3/verify-and-cleanup.cjs`
- Create: `work/user-mapping-v3/README.md`
- Test: `work/user-mapping-v3/contract.test.cjs`

**Interfaces:**
- Produces `outputs/dynamic-report-user-mapping/chapters.json` with complete chapters `08`, `09`, `10`.
- Produces `outputs/dynamic-report-user-mapping/private-state.json` containing IDs and login secrets; this file is never embedded or committed.
- Produces `outputs/dynamic-report-user-mapping/cleanup-evidence.json` with before/after counts and exact IDs.

- [ ] Write a contract test that rejects a missing clip, incomplete chapter, unscoped cleanup query, missing login proof or secrets in public manifests.
- [ ] Run `rtk proxy node --test work/user-mapping-v3/contract.test.cjs` and confirm it fails because outputs do not exist.
- [ ] Implement a recorder that creates one team and three users through the UI, completes enrollment, assigns team/report mappings, logs in each user and records visible capabilities.
- [ ] Implement cleanup by exact run-owned IDs inside a database transaction, followed by absence queries.
- [ ] Run the contract test and confirm all assertions pass.

### Task 2: Vietnamese narration and video rendering

**Files:**
- Create: `work/user-mapping-v3/narration.json`
- Create: `work/user-mapping-v3/render.py`
- Modify: `work/lifecycle-render/manifest.json` through deterministic generation.
- Test: `work/user-mapping-v3/verify-media.cjs`

**Interfaces:**
- Consumes the three complete raw WebM clips and chapter timeline.
- Produces H.264/AAC MP4 files, chapter metadata, transcript and role labels for the HTML builder.

- [ ] Write media validation that requires H.264 video, non-silent AAC audio, valid duration and at least one chapter per clip.
- [ ] Run the validation and confirm it fails before rendering.
- [ ] Add detailed Vietnamese narration explaining purpose, action and result for each chapter.
- [ ] Render at a legible resolution with top action label and bottom Vietnamese captions.
- [ ] Run media validation and visually inspect representative frames from all three clips.

### Task 3: Extend the single-file HTML guide

**Files:**
- Modify: `work/guide-v2-content.json`
- Modify: `work/build-guide-v2.py`
- Modify: `work/verify-guide-v2.cjs`
- Modify: `docs/PC02_Report_Builder_Design_Package/hdsd/quy-trinh-nhap-lieu-bao-cao-dong.html`
- Test: `outputs/huong-dan-validation-v3.json`

**Interfaces:**
- Consumes the combined old and new video manifest.
- Produces one HTML file with ten playable clips and the expanded user-mapping section.

- [ ] Add a failing guide assertion for ten clips, the user-mapping table, role filters, embedded media and offline operation.
- [ ] Expand content with account fields, account status, system role, team membership and report-role mapping explanations.
- [ ] Add clips 08–10 to the existing playlist and continuous playback order.
- [ ] Build the HTML and run Playwright validation for all clips, chapter seeks, automatic progression, filters, embedded Excel and mobile width.
- [ ] Copy the validated HTML to the requested `hdsd` path and compare SHA-256 hashes.

### Task 4: Review and delivery evidence

**Files:**
- Create: `outputs/huong-dan-user-mapping-summary.json`
- Create: `outputs/huong-dan-xem-clip-v3.png`

**Interfaces:**
- Consumes media validation, HTML validation and cleanup evidence.
- Produces the final reviewer-readable proof bundle.

- [ ] Review factual claims against `UserManagementPage`, `TeamsPage`, `ReportTeamsStep`, admin/team services and the Prisma schema.
- [ ] Confirm the final database cleanup evidence has zero remaining run-owned users, memberships, team, report roles and enrollment records.
- [ ] Run the final HTML verifier after the last build; no cached validation may predate the HTML.
- [ ] Record final hash, byte size, clip count, total duration, offline status and cleanup verdict.
