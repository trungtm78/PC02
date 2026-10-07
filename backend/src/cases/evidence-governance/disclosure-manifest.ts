import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { canonicalJson } from '../governance/case-governance.contract';

export interface DisclosureManifestItem {
  assetVersionId: string;
  ownerCaseId?: string;
  relationId?: string | null;
  relationRevision?: number | null;
  documentId: string;
  sha256: string;
  byteLength: number;
  redaction: unknown;
  lineage: unknown;
}
export interface DisclosureManifest {
  schemaVersion: 1;
  packetId: string;
  caseId: string;
  revision: number;
  recipientId: string;
  recipientPolicy: unknown;
  purpose: string;
  basis: string;
  expiresAt: string;
  items: DisclosureManifestItem[];
  deltaOfPacketId?: string | null;
}
export interface DisclosureBundle {
  manifest: DisclosureManifest;
  manifestHash: string;
  files: Array<{ assetVersionId: string; base64: string }>;
  notice: string;
}
export function manifestHash(manifest: unknown): string {
  return createHash('sha256').update(canonicalJson(manifest)).digest('hex');
}
export function verifyDisclosureBundle(
  bundle: unknown,
  trustedApprovalHash: string,
): { valid: boolean; manifestHash: string; itemCount: number } {
  if (!/^[a-f0-9]{64}$/.test(trustedApprovalHash))
    throw new BadRequestException(
      'A separately trusted approval hash is required',
    );
  const value = bundle as DisclosureBundle;
  const hash = manifestHash(value?.manifest);
  if (
    hash !== trustedApprovalHash ||
    value.manifestHash !== trustedApprovalHash
  )
    throw new ConflictException('Disclosure approval hash does not match');
  if (
    value.manifest.schemaVersion !== 1 ||
    !Array.isArray(value.manifest.items) ||
    !value.manifest.items.length ||
    !Array.isArray(value.files) ||
    value.files.length !== value.manifest.items.length
  )
    throw new BadRequestException('Invalid disclosure bundle');
  const seen = new Set<string>();
  for (const item of value.manifest.items) {
    if (!item.assetVersionId || seen.has(item.assetVersionId))
      throw new BadRequestException('Duplicate disclosure asset');
    seen.add(item.assetVersionId);
    const matches = value.files.filter(
      (file) => file.assetVersionId === item.assetVersionId,
    );
    if (matches.length !== 1 || typeof matches[0].base64 !== 'string')
      throw new BadRequestException('Missing or duplicate disclosure bytes');
    const bytes = Buffer.from(matches[0].base64, 'base64');
    if (
      bytes.toString('base64') !== matches[0].base64 ||
      bytes.length !== item.byteLength ||
      createHash('sha256').update(bytes).digest('hex') !== item.sha256
    )
      throw new ConflictException(
        'Disclosure byte integrity verification failed',
      );
  }
  return { valid: true, manifestHash: hash, itemCount: seen.size };
}
