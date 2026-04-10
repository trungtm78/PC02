/**
 * Page Object Model — PetitionsPage
 * TASK-ID: TASK-2026-260202 | EXECUTION-ID: INTAKE-20260226-001-REWORK-01
 *
 * Centralises all selectors and actions for:
 *   - PetitionListPage  (frontend/src/pages/petitions/PetitionListPage.tsx)
 *   - PetitionFormPage  (frontend/src/pages/petitions/PetitionFormPage.tsx)
 *
 * UI_ELEMENT_MAP source: grep -n "data-testid" on both files — verified 2026-02-26
 */

import { type Page, type Locator, expect } from '@playwright/test';
import * as fs from 'fs';

// ─── Selector constants (file:line verified) ──────────────────────────────────

/** PetitionListPage.tsx selectors */
export const LIST_SELECTORS = {
  /** PetitionListPage.tsx:222 — page root container */
  PAGE:                   '[data-testid="petition-list-page"]',
  /** PetitionListPage.tsx:235 — overdue warning banner */
  OVERDUE_WARNING:        '[data-testid="overdue-warning"]',
  /** PetitionListPage.tsx:251 — "Thêm mới" button */
  BTN_ADD:                '[data-testid="btn-add-petition"]',
  /** PetitionListPage.tsx:259 — toggle advanced search panel */
  BTN_ADVANCED_SEARCH:    '[data-testid="btn-advanced-search"]',
  /** PetitionListPage.tsx:268 — export button */
  BTN_EXPORT:             '[data-testid="btn-export"]',
  /** PetitionListPage.tsx:276 — refresh button */
  BTN_REFRESH:            '[data-testid="btn-refresh"]',
  /** PetitionListPage.tsx:293 — keyword search input */
  SEARCH_INPUT:           '[data-testid="search-input"]',
  /** PetitionListPage.tsx:300 — advanced filter panel */
  ADVANCED_SEARCH_PANEL:  '[data-testid="advanced-search-panel"]',
  /** PetitionListPage.tsx:325 — from-date filter */
  FILTER_FROM_DATE:       '[data-testid="filter-from-date"]',
  /** PetitionListPage.tsx:340 — to-date filter */
  FILTER_TO_DATE:         '[data-testid="filter-to-date"]',
  /** PetitionListPage.tsx:356 — unit filter select */
  FILTER_UNIT:            '[data-testid="filter-unit"]',
  /** PetitionListPage.tsx:368 — status filter select */
  FILTER_STATUS:          '[data-testid="filter-status"]',
  /** PetitionListPage.tsx:392 — sender name filter */
  FILTER_SENDER:          '[data-testid="filter-sender"]',
  /** PetitionListPage.tsx:435 — results table */
  TABLE:                  '[data-testid="petition-table"]',
  /** PetitionListPage.tsx:491 — repeating row */
  ROW:                    '[data-testid="petition-row"]',
  /** PetitionListPage.tsx:504 — overdue badge inside a row */
  OVERDUE_BADGE:          '[data-testid="overdue-badge"]',
  /** PetitionListPage.tsx:563 — action dropdown trigger button */
  BTN_ACTION_MENU:        '[data-testid="btn-action-menu"]',
  /** PetitionListPage.tsx:575 — "Chuyển thành Vụ việc" menu item */
  BTN_CONVERT_INCIDENT:   '[data-testid="btn-convert-incident"]',
  /** PetitionListPage.tsx:583 — "Chuyển thành Vụ án" menu item */
  BTN_CONVERT_CASE:       '[data-testid="btn-convert-case"]',
  /** PetitionListPage.tsx:591 — "Hướng dẫn" menu item */
  BTN_GUIDE:              '[data-testid="btn-guide"]',
  /** PetitionListPage.tsx:599 — "Lưu đơn" menu item */
  BTN_ARCHIVE:            '[data-testid="btn-archive"]',
  // Convert-incident modal fields
  /** PetitionListPage.tsx:752 — incident name input (modal) */
  FIELD_INCIDENT_NAME:    '[data-testid="field-incident-name"]',
  /** PetitionListPage.tsx:763 — incident type select (modal) */
  FIELD_INCIDENT_TYPE:    '[data-testid="field-incident-type"]',
  /** PetitionListPage.tsx:795 — confirm incident convert button */
  BTN_CONFIRM_INCIDENT:   '[data-testid="btn-confirm-convert-incident"]',
  // Convert-case modal fields
  /** PetitionListPage.tsx:895 — case name input (modal) */
  FIELD_CASE_NAME:        '[data-testid="field-case-name"]',
  /** PetitionListPage.tsx:906 — crime type select (modal) */
  FIELD_CRIME:            '[data-testid="field-crime"]',
  /** PetitionListPage.tsx:924 — jurisdiction select (modal) */
  FIELD_JURISDICTION:     '[data-testid="field-jurisdiction"]',
  /** PetitionListPage.tsx:977 — confirm case convert button */
  BTN_CONFIRM_CASE:       '[data-testid="btn-confirm-convert-case"]',
} as const;

/** PetitionFormPage.tsx selectors */
export const FORM_SELECTORS = {
  /** PetitionFormPage.tsx:220 — page root container */
  PAGE:                   '[data-testid="petition-form-page"]',
  /** PetitionFormPage.tsx:227 — back navigation */
  BTN_BACK:               '[data-testid="btn-back"]',
  /** PetitionFormPage.tsx:247 — cancel button (header) */
  BTN_CANCEL_TOP:         '[data-testid="btn-cancel-top"]',
  /** PetitionFormPage.tsx:255 — save button (header) */
  BTN_SAVE_TOP:           '[data-testid="btn-save-top"]',
  /** PetitionFormPage.tsx:267 — validation error container */
  VALIDATION_ERRORS:      '[data-testid="validation-errors"]',
  /** PetitionFormPage.tsx:305 — received date input */
  FIELD_RECEIVED_DATE:    '[data-testid="field-receivedDate"]',
  /** PetitionFormPage.tsx:320 — STT / received number */
  FIELD_RECEIVED_NUMBER:  '[data-testid="field-receivedNumber"]',
  /** PetitionFormPage.tsx:334 — unit select */
  FIELD_UNIT:             '[data-testid="field-unit"]',
  /** PetitionFormPage.tsx:370 — sender name */
  FIELD_SENDER_NAME:      '[data-testid="field-senderName"]',
  /** PetitionFormPage.tsx:384 — sender birth year */
  FIELD_SENDER_BIRTH:     '[data-testid="field-senderBirthYear"]',
  /** PetitionFormPage.tsx:400 — sender address */
  FIELD_SENDER_ADDRESS:   '[data-testid="field-senderAddress"]',
  /** PetitionFormPage.tsx:417 — sender phone */
  FIELD_SENDER_PHONE:     '[data-testid="field-senderPhone"]',
  /** PetitionFormPage.tsx:432 — sender email */
  FIELD_SENDER_EMAIL:     '[data-testid="field-senderEmail"]',
  /** PetitionFormPage.tsx:459 — suspected person */
  FIELD_SUSPECTED_PERSON: '[data-testid="field-suspectedPerson"]',
  /** PetitionFormPage.tsx:476 — suspected address */
  FIELD_SUSPECTED_ADDR:   '[data-testid="field-suspectedAddress"]',
  /** PetitionFormPage.tsx:499 — petition type select */
  FIELD_PETITION_TYPE:    '[data-testid="field-petitionType"]',
  /** PetitionFormPage.tsx:517 — priority select */
  FIELD_PRIORITY:         '[data-testid="field-priority"]',
  /** PetitionFormPage.tsx:537 — summary textarea */
  FIELD_SUMMARY:          '[data-testid="field-summary"]',
  /** PetitionFormPage.tsx:551 — detail content textarea */
  FIELD_DETAIL:           '[data-testid="field-detailContent"]',
  /** PetitionFormPage.tsx:566 — attachments note */
  FIELD_ATTACHMENTS:      '[data-testid="field-attachmentsNote"]',
  /** PetitionFormPage.tsx:591 — deadline date */
  FIELD_DEADLINE:         '[data-testid="field-deadline"]',
  /** PetitionFormPage.tsx:608 — assigned officer */
  FIELD_ASSIGNED_TO:      '[data-testid="field-assignedTo"]',
  /** PetitionFormPage.tsx:622 — notes */
  FIELD_NOTES:            '[data-testid="field-notes"]',
  /** PetitionFormPage.tsx:634 — cancel button (footer) */
  BTN_CANCEL:             '[data-testid="btn-cancel"]',
  /** PetitionFormPage.tsx:642 — save / submit button (footer) */
  BTN_SAVE:               '[data-testid="btn-save"]',
} as const;

// ─── Page Object ──────────────────────────────────────────────────────────────

export class PetitionsPage {
  readonly page: Page;

  // List page locators
  readonly listPage: Locator;
  readonly btnAdd: Locator;
  readonly btnAdvancedSearch: Locator;
  readonly advancedSearchPanel: Locator;
  readonly searchInput: Locator;
  readonly filterStatus: Locator;
  readonly filterFromDate: Locator;
  readonly filterToDate: Locator;
  readonly filterSender: Locator;
  readonly table: Locator;
  readonly overdueBadges: Locator;

  // Form page locators
  readonly formPage: Locator;
  readonly validationErrors: Locator;
  readonly fieldReceivedDate: Locator;
  readonly fieldReceivedNumber: Locator;
  readonly fieldSenderName: Locator;
  readonly fieldSenderAddress: Locator;
  readonly fieldPetitionType: Locator;
  readonly fieldPriority: Locator;
  readonly fieldSummary: Locator;
  readonly fieldDetail: Locator;
  readonly btnSave: Locator;
  readonly btnCancel: Locator;

  // Convert-case modal locators
  readonly fieldCaseName: Locator;
  readonly fieldCrime: Locator;
  readonly fieldJurisdiction: Locator;
  readonly btnConfirmCase: Locator;

  // Convert-incident modal locators
  readonly fieldIncidentName: Locator;
  readonly fieldIncidentType: Locator;
  readonly btnConfirmIncident: Locator;

  constructor(page: Page) {
    this.page = page;

    // List
    this.listPage           = page.locator(LIST_SELECTORS.PAGE);
    this.btnAdd             = page.locator(LIST_SELECTORS.BTN_ADD);
    this.btnAdvancedSearch  = page.locator(LIST_SELECTORS.BTN_ADVANCED_SEARCH);
    this.advancedSearchPanel = page.locator(LIST_SELECTORS.ADVANCED_SEARCH_PANEL);
    this.searchInput        = page.locator(LIST_SELECTORS.SEARCH_INPUT);
    this.filterStatus       = page.locator(LIST_SELECTORS.FILTER_STATUS);
    this.filterFromDate     = page.locator(LIST_SELECTORS.FILTER_FROM_DATE);
    this.filterToDate       = page.locator(LIST_SELECTORS.FILTER_TO_DATE);
    this.filterSender       = page.locator(LIST_SELECTORS.FILTER_SENDER);
    this.table              = page.locator(LIST_SELECTORS.TABLE);
    this.overdueBadges      = page.locator(LIST_SELECTORS.OVERDUE_BADGE);

    // Form
    this.formPage           = page.locator(FORM_SELECTORS.PAGE);
    this.validationErrors   = page.locator(FORM_SELECTORS.VALIDATION_ERRORS);
    this.fieldReceivedDate  = page.locator(FORM_SELECTORS.FIELD_RECEIVED_DATE);
    this.fieldReceivedNumber = page.locator(FORM_SELECTORS.FIELD_RECEIVED_NUMBER);
    this.fieldSenderName    = page.locator(FORM_SELECTORS.FIELD_SENDER_NAME);
    this.fieldSenderAddress = page.locator(FORM_SELECTORS.FIELD_SENDER_ADDRESS);
    this.fieldPetitionType  = page.locator(FORM_SELECTORS.FIELD_PETITION_TYPE);
    this.fieldPriority      = page.locator(FORM_SELECTORS.FIELD_PRIORITY);
    this.fieldSummary       = page.locator(FORM_SELECTORS.FIELD_SUMMARY);
    this.fieldDetail        = page.locator(FORM_SELECTORS.FIELD_DETAIL);
    this.btnSave            = page.locator(FORM_SELECTORS.BTN_SAVE);
    this.btnCancel          = page.locator(FORM_SELECTORS.BTN_CANCEL);

    // Convert-case modal
    this.fieldCaseName      = page.locator(LIST_SELECTORS.FIELD_CASE_NAME);
    this.fieldCrime         = page.locator(LIST_SELECTORS.FIELD_CRIME);
    this.fieldJurisdiction  = page.locator(LIST_SELECTORS.FIELD_JURISDICTION);
    this.btnConfirmCase     = page.locator(LIST_SELECTORS.BTN_CONFIRM_CASE);

    // Convert-incident modal
    this.fieldIncidentName  = page.locator(LIST_SELECTORS.FIELD_INCIDENT_NAME);
    this.fieldIncidentType  = page.locator(LIST_SELECTORS.FIELD_INCIDENT_TYPE);
    this.btnConfirmIncident = page.locator(LIST_SELECTORS.BTN_CONFIRM_INCIDENT);
  }

  // ─── Navigation ─────────────────────────────────────────────────────────────

  async gotoList() {
    await this.page.goto('/petitions');
    await expect(this.listPage).toBeVisible();
  }

  async gotoNew() {
    await this.page.goto('/petitions/new');
    await expect(this.formPage).toBeVisible();
  }

  // ─── Form actions ────────────────────────────────────────────────────────────

  /**
   * Fill the minimum required fields on the create form.
   * @param stt  Unique STT/receivedNumber — use Date.now() to avoid conflicts
   */
  async fillRequiredFields(opts: {
    stt: string;
    senderName: string;
    senderAddress: string;
    summary: string;
    detail: string;
    receivedDate?: string;
    petitionTypeIndex?: number;
    priorityIndex?: number;
  }) {
    const {
      stt, senderName, senderAddress, summary, detail,
      receivedDate = '2026-02-26',
      petitionTypeIndex = 1,
      priorityIndex = 1,
    } = opts;

    await this.fieldReceivedDate.fill(receivedDate);
    await this.fieldReceivedNumber.fill(stt);
    await this.fieldSenderName.fill(senderName);
    await this.fieldSenderAddress.fill(senderAddress);
    await this.fieldPetitionType.selectOption({ index: petitionTypeIndex });
    await this.fieldPriority.selectOption({ index: priorityIndex });
    await this.fieldSummary.fill(summary);
    await this.fieldDetail.fill(detail);
  }

  async submit() {
    await this.btnSave.click();
    await this.page.waitForURL('**/petitions', { timeout: 10000 });
  }

  // ─── List actions ────────────────────────────────────────────────────────────

  /** Get the first row matching a text substring */
  rowWithText(text: string) {
    return this.page
      .locator(LIST_SELECTORS.ROW, { hasText: text })
      .first();
  }

  async openActionMenu(rowText: string) {
    const row = this.rowWithText(rowText);
    await row.locator(LIST_SELECTORS.BTN_ACTION_MENU).click();
  }

  async openConvertCaseModal(rowText: string) {
    await this.openActionMenu(rowText);
    await this.page.locator(LIST_SELECTORS.BTN_CONVERT_CASE).click();
    await expect(this.fieldCaseName).toBeVisible();
  }

  async openConvertIncidentModal(rowText: string) {
    await this.openActionMenu(rowText);
    await this.page.locator(LIST_SELECTORS.BTN_CONVERT_INCIDENT).click();
    await expect(this.fieldIncidentName).toBeVisible();
  }

  async fillConvertCaseModal(opts: {
    caseName: string;
    crime: string;
    jurisdiction: string;
  }) {
    await this.fieldCaseName.fill(opts.caseName);
    await this.fieldCrime.selectOption(opts.crime);
    await this.fieldJurisdiction.selectOption(opts.jurisdiction);
  }

  async confirmConvertCase() {
    await this.btnConfirmCase.click();
    await this.page.waitForURL('**/petitions', { timeout: 10000 });
  }

  async fillConvertIncidentModal(opts: {
    incidentName: string;
    incidentTypeIndex?: number;
  }) {
    await this.fieldIncidentName.fill(opts.incidentName);
    if (opts.incidentTypeIndex !== undefined) {
      await this.fieldIncidentType.selectOption({ index: opts.incidentTypeIndex });
    }
  }

  async confirmConvertIncident() {
    await this.btnConfirmIncident.click();
  }

  // ─── Screenshots ─────────────────────────────────────────────────────────────

  async screenshot(
    step: number,
    description: string,
    dir = 'test-results/uat/screenshots',
  ) {
    fs.mkdirSync(dir, { recursive: true });
    await this.page.screenshot({
      path: `${dir}/petitions-step${String(step).padStart(2, '0')}-${description}.png`,
      fullPage: false,
    });
  }
}
