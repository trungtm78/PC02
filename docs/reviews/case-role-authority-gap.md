# CG-RP01 — Application account/role paths can acquire business authority

First pass read-only. MAJOR OPEN, CG07/CG14; seed exclusion CG-R01 alone does not prove separation of technical administration and business approval.

Evidence: AdminService.updateRolePermissions accepts every catalog permission, including newly registered CaseGovernance permissions, and creates rolePermission rows under User.write plus optimistic permission-set locking. There is no current explicit CaseGovernance management check. AdminService user creation/update accepts roleId; a technical administrator can assign a business role to themselves or another account. Existing credential reset/profile email/2FA administration can also affect a business-role account. These application routes could acquire or impersonate the explicit business capability that core checks correctly.

Closure: current explicit CaseGovernance.manage_access authority is required when modifying CaseGovernance role capabilities, assigning/removing a role carrying those capabilities, or changing authentication/security attributes of such an account. Preserve ordinary non-governance account/role management. Recheck actual actor/old+new role authority inside the transaction, bind versions/audit and block self acquisition of new privileged governance capabilities. Inventory bulk enrollment/import/reset/2FA paths and route them through the same guarded helper. No automatic ADMIN grant; bootstrap of a business authority remains an explicit trusted provisioning action, not an application self-upgrade. Infrastructure database ownership is outside this application permission guarantee.

The repository's actual account management permission is User.write, not an invented User.edit action. Use actual catalog actions for principal access-mode management as well. Add negative technical administrator and positive delegated business-manager regressions, including alternate/bulk paths. Assign with Case child/graph ACL closure because its Admin files have no current writer; coordinate shared foundation helpers.

No product changes by this review.
