# Security Specification — QTA-NC Studio (`qta-nc-auditor-senai`)

## 1. Data Invariants
1. Every document under `/users/{userId}/audits/{auditId}`, `/users/{userId}/commits/{commitId}`, and `/users/{userId}/cadPatches/{patchId}` MUST belong strictly to `request.auth.uid == userId` with `request.auth.token.email_verified == true`.
2. Every `ownerId` inside a stored record MUST equal `request.auth.uid` on creation and MUST remain immutable on updates.
3. Every `createdAt` timestamp MUST equal `request.time` (server timestamp).
4. Every string field is bounded by strict `.size()` limits matching `firebase-blueprint.json` to prevent resource exhaustion / Denial-of-Wallet.
5. Path variables (`userId`, `auditId`, `commitId`, `patchId`) must match `^[a-zA-Z0-9_\-]+$` (`<= 128` chars).
6. No shadow fields or unlisted keys are accepted (`keys().hasAll(...) && keys().hasOnly(...)`).

## 2. Dirty Dozen Security Test Payloads
1. Unauthenticated read/write to `/users/u1/audits/a1` -> `PERMISSION_DENIED`.
2. Unverified email (`email_verified == false`) attempting create -> `PERMISSION_DENIED`.
3. Cross-tenant read/list/write (`uid = u2` accessing `/users/u1/audits`) -> `PERMISSION_DENIED`.
4. Spoofed `ownerId` (`uid = u1` writing `ownerId: "u2"`) -> `PERMISSION_DENIED`.
5. Shadow field injection (`isAdmin: true` or `extra: "x"`) -> `PERMISSION_DENIED`.
6. Client-forged `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
7. Invalid `tierLevel` enum (`"TIER_V"`) -> `PERMISSION_DENIED`.
8. Invalid `overallStatus` enum (`"UNKNOWN"`) -> `PERMISSION_DENIED`.
9. Oversized `sourceUrl` (> 1000 chars) -> `PERMISSION_DENIED`.
10. Oversized `remediationSvg` (> 120000 chars) -> `PERMISSION_DENIED`.
11. ID poisoning (`auditId` containing `/` or `> 128` chars) -> `PERMISSION_DENIED`.
12. Mutating immutable `ownerId` or `createdAt` on update -> `PERMISSION_DENIED`.
