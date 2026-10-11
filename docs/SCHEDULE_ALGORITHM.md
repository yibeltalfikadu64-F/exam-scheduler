# Scheduling algorithm (design)

> **Status:** design only. The engine is implemented in **Phase 7**. This
> document records the intended approach so the schema and constraints stay
> aligned with it.

## Problem

Assign each exam (a `section` in an `exam_period`) to a `(exam_date, time_slot,
room, invigilators)` tuple within the period's date range, such that:

- **hard constraints** are never violated;
- **soft constraints** are minimised by an objective (cost) function.

Inputs: sections + enrollments (cohort sizes), rooms + capacities, time slots,
exam period windows, instructor/invigilator availability, and the configured
rows in `schedule_constraints`.

Output: one `exam_schedules` row (a version) plus its `exam_schedule_details`
and `invigilations`. Detected violations are written to `schedule_conflicts`.

## Hard constraints (seeded in `006_schedule_constraints.sql`)

| Key | Rule |
|-----|------|
| `no_student_overlap` | No student has two overlapping exams |
| `no_room_double_booking` | A room hosts at most one exam per date/slot |
| `room_capacity_adequate` | `room.capacity >= total_students` |
| `exam_fits_time_slot` | `duration <= slot length` |
| `no_invigilator_overlap` | No invigilator has overlapping duties |

## Soft constraints

| Key | Objective term | Default weight |
|-----|----------------|----------------|
| `spread_exams_across_days` | Balance exams per day per cohort | 0.70 |
| `respect_rest_period` | Keep the configured gap between a cohort's exams | 0.50 |
| `balance_room_utilization` | Distribute usage across rooms | 0.40 |
| `fair_invigilation_load` | Balance invigilation hours per instructor | 0.60 |

Weights are stored per constraint (`weight`) and are tunable from the UI.

## Approach

1. **Build the model.** Load sections, cohort sizes (via `enrollments`), rooms,
   slots and dates. Derive, for each pair of sections, whether they *must not*
   overlap (shared students) → a conflict graph.
2. **Construct an initial solution.** Greedy/backtracking assignment in order of
   difficulty (largest cohorts and most-constrained sections first), choosing the
   earliest feasible `(date, slot, room)`.
3. **Improve.** Local search (simulated annealing / hill-climbing with swaps and
   moves) minimising the weighted soft-cost while rejecting any move that breaks
   a hard constraint.
4. **Assign invigilators.** Feasibility-constrained matching of invigilators to
   exams honouring `no_invigilator_overlap` and spreading load.
5. **Score & persist.** Write a new `exam_schedules` version (never overwrite a
   published version), the details, invigilations, and any residual
   `schedule_conflicts`.

The algorithm is **deterministic given a seed** so results are reproducible and
comparable across runs.

## Data structures

- `conflictGraph: Map<sectionId, Set<sectionId>>` — pairs that cannot share a slot.
- Occupancy maps keyed by `(date, slot, room)` and `(date, slot, invigilator)`.
- A cost accumulator per soft-constraint key.

## Performance targets

| Scale | Target |
|-------|--------|
| ~500 exams, ~40 rooms, 4 slots/day, ~14 days | initial solution < 2 s, improvement budget ≤ 10 s |

## Validation

Every generated schedule is re-checked independently (pure validator, no solver
state). A schedule is only eligible for publication (`status = published`) when
it has zero open **hard** conflicts.
