# Intake from scanned images, read by an LLM

Date: 2026-11-03. Status: design approved by the owner (decisions D1 and the 2026-11-03 standing directive: deepest governance,
best extensibility, no scope reduction, scope increases allowed, sequencing may change). Reviewed by `/plan-eng-review` and an
outside review (Codex `gpt-6-astra`, 11 findings, all applied).

## Problem

Officers type every field of a Petition (Don thu), Incident (Vu viec) and Case (Vu an) by hand from paper they receive.
The paper has **no standard template**: handwritten or typed complaints, transfer slips, official letters, receipt stamps,
phone photos that are skewed or partly covered. Several pages can contradict each other (one real sample quoted three different
loss amounts across a transfer slip and a complaint).

Goal: the officer picks several scanned images on the create form; the system transcribes, analyses and fills the open form.
The officer reviews on the form and saves manually. If anything fails, the read is repeated from the stored images.

## Decisions (owner)

1. Providers: cloud (Gemini default Flash, OpenAI, Anthropic) **and** self-hosted (OpenAI-compatible). Feature is **off** until enabled.
2. Result is **filled straight into the open form**; the system never saves a record by itself.
3. After save, the scans become attached documents (type `BAN_SCAN`). An abandoned session is purged after 7 days.
4. Input is a complaint / denunciation bundle, often with a transfer slip or official letter. **No fixed layout.**
5. Several images in one run are the pages of **one** bundle.
6. Summary = opening paragraph + numbered points, with an automatic completeness check that is never presented as proof.
7. The system analyses first, then fills. The analysis stays visible beside the form.
8. The record type is decided by the open screen.
9. The admin must test an API key before it can be used.
10. Re-reading from a **saved** record is in scope (D1).

## Verified facts that shape the design

| Fact | Evidence |
|---|---|
| No LLM/OCR integration exists; Node 22 has `fetch` | repo search |
| `GET /settings` returns raw values to anyone with `Setting:read`, so keys cannot live in `SystemSetting` | `settings.controller.ts` |
| `PII_PATTERN` matches key **names** only and lets `apiKey` through | `audit.utils.ts:17` |
| `GET /audit` needs only `AuditLog:read`; values must never go into audit metadata | `audit.controller.ts:25`, learning `pc02-audit-log-not-report-scoped` |
| AES-256-GCM exists for TOTP | `auth/services/totp-encryption.service.ts:39-55` |
| `Document` needs an existing parent record; storage is O_EXCL immutable | `documents/*` |
| nginx 25 MB body, 90 s read timeout, CSP `connect-src 'self'` | `scripts/deploy/nginx-pc02.conf` |
| Money is stored in **VND** although the form caption says millions | `schema.prisma:968`, `buildCreateCasePayload.test.ts:431` |
| Unknown subject role falls to `SUSPECT` | `buildCreateCasePayload.ts:715-724` |
| Forms are plain `useState`; Petition already has whole-form dirty tracking | `PetitionFormPage/index.tsx:183` |
| Vietnam PDPL 91/2025 (in force 2026-01-01) treats overseas cloud as a cross-border transfer needing an impact assessment filed with the Ministry of Public Security within 60 days | public sources |
| Naming: Vu viec = `Incident`, Vu an = `Case` | repo |

## Architecture

```
 form open -> choose images -> POST /ocr/phien -> POST .../trang (one original file per request, untouched bytes)
   server: store ORIGINAL (immutable, sha256) -> derive provider copy (rotate, resize, strip EXIF) with recorded transforms
   -> job rows in DB (claimed with FOR UPDATE SKIP LOCKED, server-wide concurrency cap)
   G1 transcribe each page -> G2 analyse the bundle (typed evidence) -> G3 project into the open form (DETERMINISTIC)
   -> G4 verify with code (quotes, units, numbers, ids, contradictions, unassigned segments)
   -> fill in place with per-field patches -> officer reviews, confirms orange fields -> Save
   Save payload carries ocrPhienId + revision; the create transaction binds the session and queues a durable finalisation job
```

### 1. LLM gateway and configuration (admin only)
- Table of providers: type, encrypted key (`v<N>:iv:ct:tag`), last four characters, base URL (self-hosted only), model, data region,
  zero-retention flag, role (PRIMARY / FALLBACK / OFF), last test result. Exactly one PRIMARY (partial unique index). A row without a
  passing test for the exact key+model+URL cannot hold a role.
- Three adapters behind one `LlmProvider` interface: Gemini, Anthropic, OpenAI-compatible (serves OpenAI and self-hosted).
  Structured output is requested natively (`responseSchema`, `json_schema`, tool `input_schema`) **and** re-validated server side.
  Every project schema must compile on all three adapters (contract test).
- The gateway is the only caller: bounded retry on 408/429/5xx (honouring `Retry-After`), fallback keeping the schema,
  per-user daily page quota, monthly cost cap (warn at 80 %, hard stop at 100 %), per-attempt lineage (session, provider, model,
  region, tokens, estimated cost, prompt version). Lineage holds no content and is retained as legal evidence.
- **Cross-border gate:** a cloud provider may be called only while a transfer-impact-assessment record exists (file number, filing date,
  approver). Withdrawing it blocks cloud calls immediately. Self-hosted is exempt.
- **Destination-specific permission:** `OcrImport:sendInternal` / `OcrImport:sendCloud`. Reading a document never implies sending it out;
  falling back to a destination of a different kind re-checks permission.
- SSRF: self-hosted base URL resolved at call time, link-local/metadata ranges blocked, redirects refused, allow-list for private ranges.
- **Key test before use**, `POST /llm/kiem-thu` (key used for that call only, never stored or logged): network, key validity, model exists and
  sees images, read a synthetic Vietnamese test image (must return the exact text and number), schema-valid reply, latency/tokens/quota.
  Changing key, model or URL invalidates the previous result. Throttle 5/min/user.
- Admin screen offers create, edit, delete (archive when lineage exists), test, retest, set role, withdraw assessment, quotas.

### 2. Field catalogue generated from the forms, with per-field AI policy
- `npm run gen:khai-nhap-tu-anh` reads the legacy layouts of all three entities in the frontend and generates the server-side catalogue
  (field, caption, kind, options, directory source, DTO key). Same pattern and gate as `gen-khai-xuat-day-du.ts`.
- `chinh-sach-o.ts` classifies **every** field into exactly one policy: `AI_FILL`, `AI_FILL_MUST_CONFIRM`, `NEVER_AI`.
  Unclassified field = red CI gate (with a seeded fault proving the gate fires). Statistics fields in `metadata` default to `NEVER_AI`.
- Every `AI_FILL*` field has a declared **projection rule** (which part of the evidence, which normaliser or directory lookup).
- **Unit contract:** every numeric field declares its stored unit. `soTienBiThietHai` is VND. Tests cover extraction -> form -> payload -> row.
- **Legal role table:** "accused person" never becomes `SUSPECT` by default; only with a quoted prosecution decision plus officer confirmation.
- Parts outside `LegacyFormSpec.write` (case `subjects[]`, `metaState`/`parityState`, dynamic fields, runtime write restrictions)
  have explicit adapters. Applied fill = intersection of AI policy, projection rule and runtime write permission.

### 3. Sessions and pipeline
- Originals are never re-encoded; the hash authenticates what the officer uploaded. Derived copies keep lineage to the original
  (same model as `CaseAssetVersion`). Re-reads rebuild derivatives from originals.
- PDF is its own subsystem: limits (pages, decoded pixels, memory, time) enforced **before** decoding, page split in a worker with resource
  limits, rasterisation for self-hosted isolated in a child process, encrypted/corrupt files rejected clearly. Never in the API request thread.
- Everything is an **immutable revision**: page list (ids + hashes), per-page transcript, configuration, analysis. Results bind to their input
  revisions; workers write compare-and-set against the current revision; a stale completion is kept in history but never becomes current.
  Citations point at page **ids**.
- Evidence structure from G2 is typed: persons with roles, documents and relations, events, amounts, competing claims; each statement is
  `QUOTED`, `INFERRED` or `ESTABLISHED`. The transcript is split into id'd segments; every segment must be assigned to a point or declared
  "carries no point" with a reason; unreadable regions are listed. The officer can correct a page transcript (new revision, re-analysis).
- G3 is **deterministic** projection; ambiguity stays "undecided" and flagged. G4 (pure functions, NFC-normalised): quote exists in the cited
  page transcript, unit conversion, Vietnamese number formats and words-vs-digits, ID number vs birth year/sex, date validity, amount
  contradictions (never auto-picked), directory resolution, unassigned segments, DTO whitelist (`forbidNonWhitelisted` is on).
- The UI labels the completeness check "automatic check, not a substitute for reading". Real assurance comes from the golden set.
- Jobs live in a DB table, claimed with `FOR UPDATE SKIP LOCKED`, server-wide cap `OCR_SONG_SONG_TOI_DA`, stuck jobs returned to the queue.

### 4. Access, retention and save
- Before binding: session obeys data-scope rules. After binding: scans, derivatives, transcripts and analysis are **documents of the record** and inherit
  document, scope, protected-field and asset-governance checks; they follow the record when ownership changes.
- Save carries `ocrPhienId` + revision (added to the three create DTOs). Inside the same create transaction the server binds the session, writes
  correction telemetry, and enqueues a durable finalisation job (copy originals into `Document`, `BAN_SCAN`, hashed; then delete temp files;
  orphan sweeper). Bound sessions are never purged by the 7-day rule.
- Browser drafts must not keep OCR-filled values: they store the session reference and revision only, restore from the server, and the draft key
  includes the user id.
- Correction telemetry (`do_sua_o`): per field outcome KEEP/EDIT/CLEAR/SKIPPED, confidence, provider, model, prompt version, **no values**, own permission
  (`OcrQuality:read`). Never in audit metadata.

### 5. UI
- "Intake from scan" drawer: multi-select, drag to reorder, rotate, remove, progress, cancel. One shared applier fills single-value fields through
  `LegacyFormSpec.write` plus the explicit adapters, recording a **per-field patch** `{field, before, applied, revision}`.
- Officer-typed fields are never overwritten; skipped fields are listed with "use value from image".
- **Undo is per-patch**: only fields still equal to the applied value are reverted; edited fields stay and are reported as conflicts (collections included).
- Filled fields carry an "from image" badge with quote, page and confidence on hover. **Orange** = warning or `AI_FILL_MUST_CONFIRM`; each needs an
  explicit confirm; **Save is blocked** while any orange field is unconfirmed (focus jumps to the first one).
- Comparison panel: Images | Analysis | editable Transcript. The summary field carries a checklist of points.
- Saved record: Documents tab gains "Analysis" and "Re-read from scans", which re-runs G1-G4 and opens a field diff; applying goes through the normal
  `PATCH` with `expectedUpdatedAt`, audit and send-permission checks.
- Quality dashboard `/admin/chat-luong-ocr`: per provider/model/prompt, field keep/edit/clear rates, rates by confidence band, cost, errors.

### 6. Golden set and activation gate
- Admin-managed golden set stays on the server: images plus hand-written answers, including "this field must stay empty". Scoring covers field accuracy,
  role accuracy, point coverage, contradiction detection and **fabrication rate**.
- A provider/model/prompt may become PRIMARY only with an evaluation run (after the last key/model/prompt change) above a configurable threshold.
- CLI `npm run ocr:danh-gia` runs the same scorer on images kept **outside** the repo (they contain real ID numbers). CI uses recorded responses over synthetic images
  to test the scorer; changing a prompt without re-recording fails the gate.
- Prompts are versioned files (`prompt/*.v<N>.ts`); every call records its prompt version.

## Delivery order (vertical slice first)

1. Contracts and foundations: evidence schema, field-catalogue generator, per-field policy, projection rules, unit contract, legal-role table, versioned AES-GCM, `PII_PATTERN` fix.
2. LLM gateway + configuration with the Anthropic adapter (a key is available for real tests).
3. Vertical-slice pipeline for images.
4. Petition UI.
5. Golden set and scorer, run on the slice before widening.
6. Gemini and OpenAI-compatible adapters, fallback chain.
7. PDF subsystem.
8. Incident and Case.
9. Re-read on saved records.
10. Quality and cost dashboard.

The feature stays **off** in production until step 10 is done and Gemini Flash passes the golden set.

## Out of scope
- Judging whether signatures or stamps are genuine; training or fine-tuning a model (correction telemetry accumulates the data for later);
  bulk intake of many bundles at once (owner chose one bundle per run).

## Operator prerequisites (do not block code)
- Transfer-impact-assessment file for cloud providers; outbound Internet from the production VM to provider hosts (read-only `curl` probe);
  a Claude key for testing and a Gemini key for production.

## Verification
- Pure-function tests with seeded faults for every checker; PostgreSQL 18 specs for job claiming, stale-result rejection, atomic bind, sweeper, delete order;
  adapter contract tests with recorded HTTP; frontend tests for no-overwrite, per-patch undo, save blocking, zero create calls after fill;
  golden-set evaluation (recorded in CI, real with Claude/Gemini before enabling); real-browser pass of the whole path.
- Regression guards: forms behave identically when OCR is not used; existing `PII_PATTERN` keys still filtered; existing TOTP ciphertext still decrypts.
