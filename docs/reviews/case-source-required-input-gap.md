# CG-SF01 — source forms cannot supply required default custom values

First read-only finding **MAJOR**, CG01/CG09/compatibility acceptance, reported before fixes.

The confirmed required-default validation fix must retain valid explicit source creation. `ProsecuteIncidentDto` and `ConvertToCaseDto` expose source/legal facts but no Case custom-value input. `ProsecuteModalProvider` also submits only fixed source fields. Once a published default schema has required custom fields, every conversion through these routes would reject even when an authorized operator has the needed facts.

Closure within existing architecture: add optional typed `caseCustomFields` to both DTOs/forms, validate solely through the existing Case field-definition service and merge into the new Case's `_customFields`. Server selects/pins the published default; clients cannot pick classification, schema identity or authority. Reuse the existing structured field renderer and load-error/required/access validation. Omitting required values rejects atomically; supplying authorized valid values succeeds; ordinary schemas with no required fields preserve existing flows. Cover both real API payload and UI save/reload, no free-form metadata or JSON editor.

Child-access owns backend source DTO/adapters; T4 owns source forms and adjacent interaction tests. Keep this as completion of the approved configuration/source feature, with minimal optional API extension and no unrelated behavior changes.
