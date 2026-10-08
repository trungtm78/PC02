# CG-IN01 — Required canonical name clear reaches nonnullable persistence

Read-only finding, MAJOR OPEN, CG01/CG15 field-clear acceptance.

Executed validation probe: plainToInstance(UpdateCaseDto,{name:null,updatedAt:'2026-10-06T00:00:00Z'}) followed by class-validator validate returns no errors. UpdateCaseDto extends PartialType(CreateCaseDto); nullable optional handling skips required name validators. CasesService update maps every defined dto.name, including null, into Prisma update. Case.name is a nonnullable String. No explicit required-name-null guard exists in this path.

Inference from that source contract: direct API clear can reach a Prisma validation/persistence error instead of a useful400 validation response. The DTO probe is confirmed; actual HTTP500 has not been claimed or run. Add focused regression for null required name at DTO/service boundary and a private API rollback assertion. Reject null/blank required name explicitly while omission means unchanged; preserve clear-to-null for every truly nullable field. Do not silently recreate the old name from legacy metadata to manufacture a successful clear.

T4 must also skip client-required validation for fields whose native policy marks them unwritable and omit their payload, so an unrelated edit of a dossier with hidden name is not blocked by a masked blank. T1 owns DTO/service guard; T4 owns capability-aware form validation. No source changes in this review.
