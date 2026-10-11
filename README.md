# Exam Scheduler

A production-oriented **University Exam Scheduling System** for an Ethiopian university.

- **Frontend:** React 18 + Vite + JavaScript + React Router + Redux Toolkit + Axios (external CSS design system)
- **Backend:** Node.js + Express 4 (CommonJS)
- **Database:** MySQL / MariaDB via `mysql2/promise` connection pool
- **Auth:** JWT access tokens + bcrypt password hashing + role-based authorization
- **API:** REST under `/api/v1`

> **Status:** Phase 1–3 and the base of Phase 4 are implemented (foundation, backend, database schema, dashboard shell). The remaining feature modules are pending approval.

---

## Repository layout

```
exam-scheduler/
├── backend/                 Express API (CommonJS)
│   ├── src/
│   │   ├── config/          environment, database pool, cors, logger
│   │   ├── middleware/       auth, role, error handling
│   │   ├── routes/           route definitions
│   │   ├── controllers/      request/response shaping
│   │   ├── services/         domain logic
│   │   ├── utils/            ApiError, ApiResponse, asyncHandler
│   │   └── scripts/          migrate, seed, createDatabase
│   └── .env.example
├── frontend/                React SPA (Vite)
│   └── src/
│       ├── styles/           design tokens + themes
│       ├── services/         Axios API layer
│       ├── context/          Auth + Theme providers
│       ├── store/            Redux Toolkit store
│       ├── routes/           AppRoutes, PrivateRoute, RoleRoute
│       ├── components/       layout + dashboard components
│       └── pages/            Login, Dashboard, NotFound
├── database/
│   ├── migrations/          ordered, idempotent SQL migrations
│   └── seeds/               safe sample data (no real PII)
├── shared/                  constants shared between tiers
├── docs/                    architecture, schema, algorithm, guides
├── scripts/                 dev/ops helper scripts
└── docker-compose.yml       frontend + backend + MySQL (unverified - Docker not installed)
```

---

## Prerequisites

| Tool | Version used | Notes |
|------|--------------|-------|
| Node.js | v24.21.0 (>= 18 required) | https://nodejs.org |
| npm | 11.19.0 | bundled with Node |
| MySQL / MariaDB | MariaDB 10.4.32 (XAMPP) | a running server on `127.0.0.1:3306` |
| Git | 2.55.0 | Git Bash on Windows |

---

## Quick start (Git Bash)

```bash
# 1. Install dependencies (root + backend + frontend)
npm run install:all

# 2. Create the database and a restricted application user
#    (uses backend/.env credentials to connect as a privileged user)
npm run db:create

# 3. Apply migrations and load safe sample data
npm run db:setup

# 4. Run backend + frontend together
npm run dev
```

- Backend: http://localhost:5000/api/v1/health
- Frontend: http://localhost:5173

### Configuration

Copy the example env files and fill them in:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

See `docs/DEPLOYMENT_GUIDE.md` for the full list of variables and the restricted-user creation SQL.

---

## Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install root, backend, and frontend dependencies |
| `npm run dev` | Run backend + frontend concurrently |
| `npm run dev:backend` | Run the backend only (nodemon) |
| `npm run dev:frontend` | Run the frontend only (Vite) |
| `npm run build` | Production build of the frontend |
| `npm run db:create` | Create database + restricted app user |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Load safe sample data |
| `npm run db:setup` | Migrate then seed |
| `npm run test` | Backend + frontend tests |

---

## Documentation

| Document | Contents |
|----------|----------|
| `docs/ARCHITECTURE.md` | System design and layering |
| `docs/DATABASE_SCHEMA.md` | Tables, columns, indexes, relationships |
| `docs/API_DOCUMENTATION.md` | REST endpoints and payloads |
| `docs/SCHEDULE_ALGORITHM.md` | Constraint-based scheduling engine |
| `docs/DEPLOYMENT_GUIDE.md` | Setup, migrations, deployment, backups |
| `docs/USER_MANUAL.md` | End-user guide |

---

## Safety notes

- `.env` files and credentials are **gitignored** — never commit them.
- Migrations are **additive and idempotent**. Destructive commands are never run automatically.
- The existing `exam_scheduler` database (if present) is **not** touched; this project uses `exam_scheduler_db`.
