# AGENTS.md — Project conventions & implementation plan

This file records the conventions every contributor (human or AI agent) must follow,
plus the phased plan and current status.

## 1. Non-negotiable stack

- **Frontend:** React 18 + Vite + **JavaScript** (no TypeScript), React Router, Redux Toolkit,
  Axios, `react-big-calendar` + `date-fns`, `react-hook-form` + `zod`, `recharts`, `lucide-react`.
- **Styling:** **external CSS files only** (design tokens + themes). No CSS-in-JS, no Tailwind.
- **Backend:** Node.js + Express **4**, **CommonJS** (`require` / `module.exports`).
- **Database:** MySQL / MariaDB through **`mysql2/promise`** with a connection pool. No ORM, no MongoDB.
- **API:** REST under `/api/v1`.
- **Auth:** JWT access tokens, `bcryptjs` hashing, role-based authorization.

Do **not** swap MySQL for MongoDB, React for another framework, or introduce TypeScript.

## 2. Coding conventions

### Backend
- Layers: `routes → controllers → services → database`. Controllers never write SQL directly;
  put query logic in services (or a future `repositories/` layer).
- Use `asyncHandler` to wrap async route handlers; throw `ApiError` for expected failures.
- Responses: `ApiResponse.success(res, data, message)` / `ApiResponse.error(...)`.
- **Parameterized SQL only** (`?` placeholders). Never interpolate user input into SQL strings.
- Validate environment variables at startup (`config/environment.js`).
- Tables are `snake_case`, plural. Foreign keys are `<entity>_id`. Enumerations use `ENUM`/`CHECK`.

### Frontend
- Pages compose; components render; hooks/context encapsulate behavior.
- One API module (`services/api.js`) owns the Axios instance and interceptors. Feature services
  import it; components never call `axios` directly.
- Design tokens live in `styles/variables.css`; themes fill them in `styles/themes/*.css`.
- Mock data lives in `src/data/*` and must be **clearly labeled** and never presented as if it
  were saved to MySQL.

### Database
- Migrations are numbered, ordered, and **idempotent** (`CREATE TABLE IF NOT EXISTS`).
- `updated_at` uses `ON UPDATE CURRENT_TIMESTAMP` (no triggers needed).
- Seeds use `INSERT ... ON DUPLICATE KEY UPDATE` / `INSERT IGNORE` and contain **no real PII**.
- Never run `DROP DATABASE`, `TRUNCATE`, or destructive statements automatically.

## 3. Phased plan & status

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Project foundation (folders, root config, git) | ✅ done |
| 2 | Backend foundation (Express, config, health, middleware) | ✅ done |
| 3 | MySQL schema, migrations, seeds, DB + restricted user | ✅ done |
| 4 | Frontend foundation + dashboard shell (base only) | ✅ done |
| 5 | Authentication & authorization (login/logout, roles, audit) | ⏳ pending approval |
| 6 | Feature modules (users → settings/audit) | ⏳ pending |
| 7 | Constraint-based scheduling engine | ⏳ pending |
| 8 | Complete UI pages | ⏳ pending |
| 9 | Imports/exports/notifications | ⏳ pending |
| 10 | Testing & verification | ⏳ pending |
| 11 | Documentation & deployment | ⏳ pending |
| 12 | Final acceptance | ⏳ pending |

## 4. Verification discipline

After each phase: install deps → lint → run tests → production build → report **exact** output.
Never claim a test or build passed unless it was actually run. Never fabricate a database result.
