# CG-FS-REQ01 — required default field omitted during Case creation

First review: **FAIL / MAJOR**, source examined before fixes.

Requirement: CG01, acceptance1 and4, approved configuration validation and atomic source creation.

`backend/src/cases/governance/case-field-schema.service.ts:144` compares incoming custom values with old values. For a new Case without `_customFields`, both are empty. Lines146–148 return the published default schema pin without calling `validateCustomValues`, so a required custom field can be omitted. The source-conversion adapter calls this real validator and accepts the invalid Case.

Evidence: `backend/src/case-child-access/default-required-field.integration.spec.ts` uses the real frozen validator and a valid published default definition. The expected required-field400 rejects, but the adapter returns `created-case`. Raw RED: `docs/test-evidence/case-governance/child-required-default-red.json`. The earlier fixture with an invalid custom key was corrected before claiming this specific failure.

Closure: new Case creation validates the published default required fields even when no custom values changed; missing/null/blank required values reject atomically. Valid required false/zero values remain valid. Existing unrelated edits preserve unverified legacy omissions without silently inventing values or erasing them. Ordinary create and explicit source-conversion paths must share this validator. Add regression before fixing and run the affected schema/source tests.

Ownership: root explicitly transfers only `case-field-schema.service.ts` and its adjacent spec to the active child-access writer for this closure; other frozen T1b files remain untouched. Keep a before snapshot and refresh the changed-source hash after final verification. The first review package remains a before-fix record, not a current source certification.
