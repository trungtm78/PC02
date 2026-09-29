# Petition all-column search

Search every data column in the petition list, including hidden columns. Submit with Enter or a suggestion; preserve chips, accent-insensitive matching, date precision, filters and access scope. Do not extend to every detail-form field.

Add information type to the shared registry and list search metadata. Include deadline and creation dates in global search. Include the free-text petition date in the aggregate while retaining structured and EDTF date search.

Keep tk/search API formats. Generate a new migration, Prisma shadow field, frontend registry and operational SQL. Refresh all existing petition aggregates, including non-null values, before the new schema is used. Do not deploy to production.

Acceptance: each list data column is searchable, old/new/updated records behave identically, hidden columns remain searchable, list/statistics/export share filters and scope, full suites pass, patch line coverage >=90%, lint/type-check/build have no new warnings, and UAT coverage is 100% PASS.
