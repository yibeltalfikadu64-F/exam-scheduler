# Architecture

## Overview

```
┌────────────────────────┐        HTTPS/JSON        ┌────────────────────────┐
│  React SPA (Vite)      │  ───────────────────────▶ │  Express API           │
│  Redux Toolkit         │  ◀─────────────────────── │  /api/v1               │
│  React Router          │                            │  JWT + RBAC            │
│  Axios (services/api)  │                            │                        │
└────────────────────────┘                            └───────────┬────────────┘
                                                                   │ mysql2/promise pool
                                                                   ▼
                                                        ┌────────────────────────┐
                                                        │  MySQL / MariaDB       │
                                                        │  exam_scheduler_db     │
                                                        └────────────────────────┘
```

Frontend and backend are independent processes. They communicate **only** over
the REST API under `/api/v1`; the frontend never talks to the database.

## Backend layering

```
routes  →  controllers  →  services  →  database (config/database.js pool)
```

- **routes** (`src/routes`) — declare endpoints and attach middleware.
- **controllers** (`src/controllers`) — shape requests/responses; no SQL.
- **services** (`src/services`) — domain logic and all database access.
- **config** (`src/config`) — environment validation, pool, CORS, logger.
- **middleware** (`src/middleware`) — auth, role guard, 404, error handler.
- **utils** (`src/utils`) — `ApiError`, `ApiResponse`, `asyncHandler`.

Cross-cutting rules:

- Every async handler is wrapped in `asyncHandler`; expected failures throw
  `ApiError`.
- Every response uses `ApiResponse.success(...)`; errors are normalised by the
  central `error.middleware`.
- **Parameterized SQL only** (`?` placeholders).

### Request lifecycle

1. `helmet` sets security headers.
2. `cors` enforces the `CORS_ORIGIN` allow-list.
3. `compression` + body parsers (`express.json`, `express.urlencoded`).
4. `morgan` logs the request through the shared logger.
5. `express-rate-limit` throttles `/api/v1`.
6. Routes → controllers → services.
7. Unmatched routes hit `notFoundHandler`; thrown errors hit `errorHandler`,
   which maps known MySQL error codes to sensible HTTP statuses.

### Startup & shutdown (`src/server.js`)

- `config.validateEnv()` runs before anything else and fails fast with a clear
  message.
- The database connection is tested; on failure the API still starts so
  `/api/v1/health` can report `degraded` rather than the process dying.
- `SIGINT`/`SIGTERM`, `unhandledRejection` and `uncaughtException` all trigger a
  graceful shutdown that closes the HTTP server and the MySQL pool.

## Frontend structure

```
src/
├── main.jsx            providers: Redux → Theme → Auth → Router
├── App.jsx             routing only
├── styles/             design tokens + themes + base + responsive + animations
├── services/           api.js (single Axios instance) + feature services
├── context/            ThemeContext, AuthContext
├── store/              Redux Toolkit store + slices (ui, auth)
├── routes/             AppRoutes, PrivateRoute, RoleRoute
├── components/         layout/*, dashboard/*, common/*
├── pages/              Dashboard, Login, NotFound
└── data/               mockData.js (clearly labelled prototype data)
```

Rules:

- **External CSS only.** Design tokens live in `styles/variables.css`; colour
  tokens for each theme in `styles/themes/{light,dark}.css`.
- One Axios instance (`services/api.js`) owns the base URL, the JWT request
  interceptor and the response/error normaliser. Components never import Axios.
- Pages compose; components render; contexts/hooks encapsulate behaviour.
- Mock data is confined to `src/data` and always rendered with a visible
  "prototype data" indicator.

## Security model

| Concern | Approach |
|---------|----------|
| Password storage | `bcryptjs` hashes (`BCRYPT_ROUNDS`) |
| Sessions | JWT access tokens (`Authorization: Bearer`) |
| Authorization | `authorize(...roles)` middleware + `RoleRoute` UI guard |
| SQL injection | parameterized queries only |
| Headers | `helmet` |
| Abuse | `express-rate-limit` on `/api/v1` |
| Secrets | `.env` files, gitignored, validated at boot |
| CORS | explicit origin allow-list |

Frontend guards (`PrivateRoute`, `RoleRoute`) are convenience only — the backend
is the authority.

## Phases

See `AGENTS.md` for the phase table and current status.
