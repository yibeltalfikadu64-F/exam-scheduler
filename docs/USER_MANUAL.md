# User manual

## What this system does

The Exam Scheduler helps a university plan, generate, inspect and publish exam
timetables while detecting conflicts — double-booked rooms, students with
overlapping exams, insufficient room capacity and unfair invigilation loads.

## Current status

This is an **in-progress build**. Phases 1–4 are complete: the project
foundation, the backend API (with a live `/health` endpoint), the MySQL schema
with safe sample data, and a dashboard shell.

**What you can do today**

- Open the dashboard at http://localhost:5173 and review the shell (navigation,
  KPI cards, upcoming exams, conflicts, live backend status).
- Switch between light and dark themes (top-right button).
- Confirm the API and database are healthy via the **Backend status** panel or
  `curl http://localhost:5000/api/v1/health`.

**What is not built yet**

- Signing in (Phase 5). Until then the dashboard runs in **prototype mode**: the
  figures and lists come from clearly-labelled sample data, and the login form
  honestly reports that authentication is not enabled yet.
- Departments, courses, students, rooms and the scheduling engine itself
  (Phases 6–7).

Sidebar items for unbuilt modules are disabled and tagged **“Soon”**; nothing
that leads nowhere is presented as working.

## Roles (planned)

| Role | Intended responsibilities |
|------|---------------------------|
| `admin` | Full access; users, roles, settings, audit |
| `registrar` | Owns exam periods, generates/publishes schedules |
| `department_head` | Manages courses/sections and reviews conflicts for the department |
| `instructor` | Views own exam and invigilation duties |
| `student` | Views own exam timetable |

## Reading the dashboard

- **KPI cards** — scheduled exams, active rooms, open conflicts, coverage.
- **Upcoming exams** — next exams with date, time, room and candidate count.
- **Schedule conflicts** — detected problems, colour-coded by severity.
- **Backend status** — a *live* call to the API: application version, environment,
  database name/version and query latency.

> Anything marked **“Prototype data”** is sample content, not a database record.
> The **Backend status** panel is real.

## Getting help

- Setup and troubleshooting: `docs/DEPLOYMENT_GUIDE.md`
- API reference: `docs/API_DOCUMENTATION.md`
- Data model: `docs/DATABASE_SCHEMA.md`
