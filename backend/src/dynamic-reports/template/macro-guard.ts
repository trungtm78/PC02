import JSZip from 'jszip';

/**
 * Macro rejection (spec §10 PR3: "Từ chối ... macro ..."). A `.xlsm`
 * renamed to `.xlsx` passes `assertMagicBytes` (it IS a valid zip), so the
 * actual signal — same one Excel itself uses — is the presence of
 * `xl/vbaProject.bin` regardless of the file's extension or declared MIME.
 */
export class MacroDetectedError extends Error {
  readonly code = 'MACRO_DETECTED';
  constructor() {
    super('File có macro (VBA) — không được hỗ trợ.');
    this.name = 'MacroDetectedError';
  }
}

export async function assertNoMacro(buffer: Buffer): Promise<void> {
  const zip = await JSZip.loadAsync(buffer);
  if (Object.keys(zip.files).some((n) => n === 'xl/vbaProject.bin')) {
    throw new MacroDetectedError();
  }
}
