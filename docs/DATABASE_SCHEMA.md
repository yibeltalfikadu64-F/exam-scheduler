# Database schema

Database: `exam_scheduler_db` (MySQL / MariaDB, InnoDB, `utf8mb4_unicode_ci`).

Migrations live in `database/migrations/` and are applied in filename order by
`npm run db:migrate`. Applied files are tracked in `schema_migrations`.

## Migrations

| # | File | Creates |
|---|------|---------|
| 001 | `create_departments` | `departments` |
| 002 | `create_users` | `users` |
| 003 | `create_programs` | `programs` |
| 004 | `create_courses` | `courses` |
| 005 | `create_sections` | `sections` |
| 006 | `create_students` | `students` |
| 007 | `create_enrollments` | `enrollments` |
| 008 | `create_instructors` | `instructors` |
| 009 | `create_instructor_assignments` | `instructor_assignments` |
| 010 | `create_buildings` | `buildings` |
| 011 | `create_rooms` | `rooms` |
| 012 | `create_room_capacities` | `room_capacities` |
| 013 | `create_time_slots` | `time_slots` |
| 014 | `create_exam_periods` | `exam_periods` |
| 015 | `create_exam_schedules` | `exam_schedules` |
| 016 | `create_exam_schedule_details` | `exam_schedule_details` |
| 017 | `create_invigilations` | `invigilations` |
| 018 | `create_schedule_conflicts` | `schedule_conflicts` |
| 019 | `create_schedule_constraints` | `schedule_constraints` |
| 020 | `create_notifications` | `notifications` |
| 021 | `create_audit_logs` | `audit_logs` |
| 022 | `link_department_head_fk` | `departments.head_id → users.id` (deferred FK) |

## Entity groups

### Identity & roles
- **users** — accounts. `role ∈ {admin, registrar, department_head, instructor, student}`.
  Holds lock/reset fields (`failed_login_attempts`, `account_locked_until`,
  `password_reset_token/expires`) and soft delete (`deleted_at`).
- **departments** — academic units. `head_id → users.id` (added in 022).

### Academic structure
- **programs** → belong to a department; `degree_type`, `duration_years`.
- **courses** → belong to a department, optionally a program; unique `code`.
- **sections** → a course offered in a term; `UNIQUE(course_id, section, term)`;
  optional `instructor_id`.
- **students** → belong to a program; `student_number` unique.
- **enrollments** → `student_id` × `section_id` (`UNIQUE`), `status`, `grade`.
  Drives the *no student overlap* constraint.

### Teaching staff
- **instructors** → 1:1 profile extension of a `users` row (`user_id` unique).
- **instructor_assignments** → instructor × section × role.

### Facilities
- **buildings** → contain rooms.
- **rooms** → belong to a building, `capacity`, `type`
  (`lecture|lab|hall|seminar|other`). `UNIQUE(building_id, name)`.
- **room_capacities** → dated capacity history. *Justified* because room capacity
  changes between exam periods; it keeps published schedules auditable.
  `UNIQUE(room_id, effective_from)`.

### Time & scheduling
- **time_slots** → reusable blocks (`start_time`, `end_time`, `order_index`).
- **exam_periods** → a dated exam window (`term`, `start_date`, `end_date`,
  `status`, JSON `settings`).
- **exam_schedules** → a **versioned** schedule within a period
  (`UNIQUE(exam_period_id, version)`, `status ∈ {draft, published, archived}`,
  `published_by`, `published_at`).
- **exam_schedule_details** → the individual exam entries. References section,
  room and time slot, plus `exam_date`, `start_time`, `end_time`,
  `total_students`. `UNIQUE(exam_schedule_id, exam_date, time_slot_id, room_id)`
  is a hard room double-booking guard **within a schedule version**. Student and
  invigilator conflicts (which span versions) are detected by the engine in
  Phase 7.
- **invigilations** → invigilator assignment to a detail row.
  `UNIQUE(exam_schedule_detail_id, user_id)`; optional `instructor_id` link.
- **schedule_conflicts** → detected violations with
  `type`, `severity`, `status`, and resolution tracking.
- **schedule_constraints** → configurable hard/soft rules consumed by the engine
  (`constraint_key` unique, JSON `parameters`, `weight`).

### Cross-cutting
- **notifications** → per-user in-app/email/SMS messages.
- **audit_logs** → append-only trail of sensitive actions with before/after data.

## Conventions

- `id INT UNSIGNED AUTO_INCREMENT` primary keys; `uuid CHAR(36) DEFAULT (UUID())`.
- `created_at` / `updated_at DATETIME` (the latter `ON UPDATE CURRENT_TIMESTAMP`).
- Foreign keys are explicit with `ON DELETE` / `ON UPDATE` actions.
- Enumerations use `ENUM`.
