# API documentation

Base URL: `http://localhost:5000/api/v1`

All responses share one envelope.

**Success**

```json
{
  "success": true,
  "message": "Service is healthy.",
  "data": { },
  "meta": { "timestamp": "2026-10-11T19:52:58.000Z" }
}
```

**Error**

```json
{
  "success": false,
  "message": "Route not found: GET /api/v1/nope",
  "code": "ROUTE_NOT_FOUND",
  "meta": { "timestamp": "2026-10-11T19:52:58.000Z", "path": "/api/v1/nope" }
}
```

Authentication uses `Authorization: Bearer <jwt>` (tokens issued in Phase 5).

## Implemented endpoints

### `GET /api/v1`
Service banner.

### `GET /api/v1/health`
Application + database status. Never exposes secrets.

`200` when the database is reachable, `503` when it is not.

```json
{
  "success": true,
  "message": "Service is healthy.",
  "data": {
    "status": "ok",
    "application": {
      "name": "Exam Scheduler API",
      "version": "1.0.0",
      "environment": "development",
      "uptimeSeconds": 132
    },
    "database": {
      "connected": true,
      "name": "exam_scheduler_db",
      "version": "10.4.32-MariaDB",
      "latencyMs": 3,
      "error": null
    },
    "timestamp": "2026-10-11T19:52:58.000Z"
  }
}
```

## Error codes

| HTTP | `code` (examples) | Meaning |
|------|-------------------|---------|
| 400 | `INVALID_JSON` | Malformed request body |
| 401 | `TOKEN_MISSING`, `TOKEN_INVALID` | Missing/expired/invalid JWT |
| 403 | `INSUFFICIENT_ROLE`, `CORS_BLOCKED` | Authenticated but not allowed |
| 404 | `ROUTE_NOT_FOUND` | Unknown route |
| 409 | `DUPLICATE_ENTRY`, `RELATIONSHIP_CONSTRAINT` | Conflict with existing data |
| 503 | `DATABASE_UNAVAILABLE`, `DATABASE_NOT_INITIALIZED` | Database unreachable/unset |

## Planned (later phases)

| Phase | Endpoints |
|-------|-----------|
| 5 | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, password reset |
| 6 | CRUD for `/users`, `/departments`, `/programs`, `/courses`, `/sections`, `/students`, `/instructors`, `/buildings`, `/rooms`, `/time-slots`, `/exam-periods` |
| 7 | `POST /schedules/generate`, `GET /schedules`, `POST /schedules/:id/publish`, `GET /conflicts` |
| 9 | `/exports/*`, `/imports/*`, `/notifications` |

Every list endpoint will support pagination (`page`, `limit`), sorting and
filtering, and will return a `meta.pagination` block.
