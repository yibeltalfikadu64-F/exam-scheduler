# shared/

Cross-tier, framework-agnostic values that both the backend and frontend agree on.

Currently the authoritative server-side definitions live in
`backend/src/middleware/role.middleware.js` (`ROLES`) and in the SQL `ENUM`
columns. This folder exists so those enumerations and API contracts can be
shared verbatim as the project grows, instead of being re-typed in each tier.

Planned contents:

- `constants.json` — roles, statuses, conflict types, constraint keys.
- `schemas/` — request/response shapes (JSON Schema) usable by both tiers.

Nothing here is imported by the running application yet; it is intentionally a
documentation/reference surface for now to avoid coupling the two builds.
