
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './GenerateSchedule.css';

import {
    AlertTriangle,
    CalendarDays,
    CheckCircle2,
    ClipboardList,
    LoaderCircle,
    Save,
    WandSparkles,
    Clock3,
    MapPin,
} from 'lucide-react';

import api from '../services/api';

function unwrapResponse(response) {
    let result = response?.data ?? response;

    // Support API responses wrapped in { success, data }.
    while (
        result &&
        typeof result === 'object' &&
        !Array.isArray(result) &&
        result.data &&
        typeof result.data === 'object' &&
        !Array.isArray(result.data) &&
        !Array.isArray(result.allocations) &&
        !result.schedule
    ) {
        result = result.data;
    }

    return result;
}

export default function GenerateSchedule() {
    const navigate = useNavigate();

    const [savedScheduleId, setSavedScheduleId] = useState(null);
    const [periodId, setPeriodId] = useState('');
    const [expectedExamId, setExpectedExamId] = useState('');
    const [expectedCount, setExpectedCount] = useState('');
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    async function handleGenerate(event) {
        event.preventDefault();

        const numericPeriodId = Number(periodId);

        if (
            !periodId ||
            !Number.isSafeInteger(numericPeriodId) ||
            numericPeriodId < 1
        ) {
            setError('Please enter a valid positive exam period ID.');
            return;
        }

        const hasExpectedInput =
            expectedExamId !== '' || expectedCount !== '';

        if (hasExpectedInput) {
            const validExamId =
                expectedExamId !== '' &&
                Number.isSafeInteger(Number(expectedExamId)) &&
                Number(expectedExamId) > 0;

            const validCount =
                expectedCount !== '' &&
                Number.isSafeInteger(Number(expectedCount)) &&
                Number(expectedCount) >= 1 &&
                Number(expectedCount) <= 100000;

            if (!validExamId || !validCount) {
                setError(
                    'Enter both a valid Exam ID and a whole candidate count from 1 to 100000.'
                );
                return;
            }
        }

        setLoading(true);
        setError('');
        setNotice('');
        setPreview(null);
        setSavedScheduleId(null);

        try {
            const expectedCandidates = {};

            if (expectedExamId !== '' && expectedCount !== '') {
                expectedCandidates[String(Number(expectedExamId))] =
                    Number(expectedCount);
            }

            const response = await api.post('/scheduling/preview', {
                examPeriodId: numericPeriodId,
                expectedCandidates,
            });

            const payload = unwrapResponse(response);

            const allocations =
                payload?.allocations ??
                payload?.schedule?.allocations ??
                payload?.preview?.allocations;

            const unscheduled =
                payload?.unscheduled ??
                payload?.unscheduledExams ??
                payload?.schedule?.unscheduled ??
                payload?.preview?.unscheduled ??
                [];

            if (!Array.isArray(allocations)) {
                throw new Error(
                    payload?.message ||
                    'The server response does not contain an allocations array. Check the browser console.'
                );
            }

            const normalizedPreview = {
                ...payload,
                allocations,
                unscheduled: Array.isArray(unscheduled)
                    ? unscheduled
                    : [],
                generatedCount:
                    payload.generatedCount ??
                    payload.scheduledCount ??
                    payload.summary?.scheduledCount ??
                    allocations.length,
                unscheduledCount:
                    payload.unscheduledCount ??
                    payload.summary?.unscheduledCount ??
                    (Array.isArray(unscheduled) ? unscheduled.length : 0),
            };

            setPreview(normalizedPreview);

            if (allocations.length === 0) {
                setNotice(
                    'The preview request succeeded, but no exams were assigned. Check the exam period, eligible exams, rooms, and time slots.'
                );
            } else {
                setNotice(
                    `Schedule preview generated successfully. ${allocations.length} exam(s) assigned.`
                );
            }
        } catch (err) {
            console.error('Schedule preview failed:', err);

            setError(
                err.response?.data?.message ||
                err.message ||
                'Failed to generate the schedule. Please try again.'
            );
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveDraft() {
        if (!preview?.allocations?.length) {
            setError('There are no scheduled exams to save.');
            return;
        }

        setSaving(true);
        setError('');
        setNotice('');
        setSavedScheduleId(null);

        try {
            const allocations = preview.allocations.map((item) => {
                const examId = item.examId ?? item.exam?.id;
                const roomId = item.roomId ?? item.room?.id;
                const timeSlotId =
                    item.timeSlotId ?? item.timeSlot?.id;

                return {
                    examId: Number(examId),
                    roomId: Number(roomId),
                    timeSlotId: Number(timeSlotId),
                    examDate: String(
                        item.examDate ?? item.date ?? ''
                    ).slice(0, 10),
                };
            });

            const invalidAllocation = allocations.some(
                (item) =>
                    !Number.isSafeInteger(item.examId) ||
                    item.examId < 1 ||
                    !Number.isSafeInteger(item.roomId) ||
                    item.roomId < 1 ||
                    !Number.isSafeInteger(item.timeSlotId) ||
                    item.timeSlotId < 1 ||
                    !/^\d{4}-\d{2}-\d{2}$/.test(item.examDate)
            );

            if (invalidAllocation) {
                throw new Error(
                    'Some assignments are missing a valid exam, room, time slot, or date. Check the preview response.'
                );
            }

            const apiResponse = await api.post(
                '/scheduling/schedules',
                {
                    examPeriodId: Number(periodId),
                    name: `Generated Schedule - Period ${periodId}`,
                    notes: `Automatically generated schedule. ${
                        preview.unscheduledCount ??
                        preview.unscheduled?.length ??
                        0
                    } exam(s) could not be scheduled.`,
                    allocations,
                }
            );

            const payload = unwrapResponse(apiResponse);

            const savedSchedule =
                payload?.schedule ??
                payload?.data?.schedule ??
                payload?.result?.schedule ??
                null;

            const scheduleId =
                savedSchedule?.id ??
                savedSchedule?.scheduleId ??
                payload?.scheduleId ??
                payload?.id;

            if (!scheduleId) {
                throw new Error(
                    'The save request completed, but the response did not include a schedule ID. Check the browser console.'
                );
            }

            setSavedScheduleId(scheduleId);
            setNotice(
                `Schedule saved successfully (ID: ${scheduleId}). You can now open Schedule Calendar.`
            );
        } catch (err) {
            console.error('Saving schedule failed:', err);

            setError(
                err.response?.data?.message ||
                err.message ||
                'Failed to save the schedule draft.'
            );
        } finally {
            setSaving(false);
        }
    }

    const allocations = preview?.allocations ?? [];
    const unscheduled = preview?.unscheduled ?? [];

    const scheduledCount = preview
        ? Number(preview.generatedCount ?? allocations.length)
        : 0;

    const unscheduledCount = preview
        ? Number(preview.unscheduledCount ?? unscheduled.length)
        : 0;

    function formatTime(value) {
        if (!value) return '-';
        return String(value).slice(0, 5);
    }

    function formatDate(value) {
        if (!value) return '-';

        const dateString = String(value).slice(0, 10);
        const date = new Date(`${dateString}T00:00:00`);

        if (Number.isNaN(date.getTime())) return dateString;

        return new Intl.DateTimeFormat(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        }).format(date);
    }

    function getExamName(item, index) {
        return (
            item?.exam?.title ||
            item?.exam?.courseTitle ||
            item?.exam?.courseCode ||
            item?.exam?.examType ||
            item?.examTitle ||
            `Exam ${index + 1}`
        );
    }

    function getUnscheduledReason(item) {
        if (typeof item?.reason === 'string') return item.reason;
        if (item?.reason?.message) return item.reason.message;

        return 'No suitable room or time slot was found.';
    }

    return (
        <main className="generate-page">
            <header className="generate-header">
                <div className="generate-header-content">
                    <span className="generate-eyebrow">
                        EXAMINATION MANAGEMENT
                    </span>

                    <h1 className="generate-title">
                        <span className="generate-title-icon">
                            <WandSparkles size={25} />
                        </span>
                        Generate Schedule
                    </h1>

                    <p className="generate-description">
                        Automatically generate an exam timetable, review
                        room and time assignments, and save the results as
                        a draft.
                    </p>
                </div>

                <div
                    className="generate-header-icon"
                    aria-hidden="true"
                >
                    <CalendarDays size={54} strokeWidth={1.4} />
                </div>
            </header>

            <section className="generate-panel">
                <div className="generate-panel-heading">
                    <div className="generate-panel-icon">
                        <ClipboardList size={22} />
                    </div>

                    <div>
                        <h2>Schedule Configuration</h2>
                        <p>
                            Choose an existing, open exam period to begin
                            generating your timetable.
                        </p>
                    </div>
                </div>

                <form
                    className="generate-form"
                    onSubmit={handleGenerate}
                >
                    <div className="generate-field">
                        <label
                            className="generate-label"
                            htmlFor="examPeriodId"
                        >
                            Exam Period ID
                            <span className="generate-required">*</span>
                        </label>

                        <input
                            id="examPeriodId"
                            name="examPeriodId"
                            className="generate-input"
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={periodId}
                            onChange={(event) =>
                                setPeriodId(event.target.value)
                            }
                            placeholder="e.g. 3"
                            disabled={loading}
                        />

                        <p className="generate-help">
                            Enter the ID of an existing, open exam period.
                            The backend will calculate a timetable using
                            available exams, rooms, and time slots.
                        </p>
                    </div>

                    <div className="generate-field">
                        <label
                            className="generate-label"
                            htmlFor="expectedExamId"
                        >
                            Exam ID
                        </label>

                        <input
                            id="expectedExamId"
                            name="expectedExamId"
                            className="generate-input"
                            type="number"
                            min="1"
                            step="1"
                            value={expectedExamId}
                            onChange={(event) =>
                                setExpectedExamId(event.target.value)
                            }
                            placeholder="e.g. 6"
                            disabled={loading}
                        />

                        <p className="generate-help">
                            Optional. Enter the exam whose expected
                            candidate count you want to use for this preview.
                        </p>
                    </div>

                    <div className="generate-field">
                        <label
                            className="generate-label"
                            htmlFor="expectedCount"
                        >
                            Expected Candidates
                        </label>

                        <input
                            id="expectedCount"
                            name="expectedCount"
                            className="generate-input"
                            type="number"
                            min="1"
                            max="100000"
                            step="1"
                            value={expectedCount}
                            onChange={(event) =>
                                setExpectedCount(event.target.value)
                            }
                            placeholder="e.g. 35"
                            disabled={loading}
                        />

                        <p className="generate-help">
                            Used only for generating this preview. It does
                            not create student enrollment records.
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="generate-button"
                        disabled={
                            loading ||
                            !periodId ||
                            !Number.isSafeInteger(Number(periodId)) ||
                            Number(periodId) < 1
                        }
                    >
                        {loading ? (
                            <LoaderCircle
                                className="generate-spinner"
                                size={19}
                            />
                        ) : (
                            <WandSparkles size={19} />
                        )}

                        {loading
                            ? 'Generating Schedule...'
                            : 'Generate Schedule'}
                    </button>
                </form>
            </section>

            {error && (
                <div
                    className="generate-alert generate-alert-error"
                    role="alert"
                >
                    <AlertTriangle size={20} />
                    <div>
                        <strong>Something went wrong</strong>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {notice && (
                <div
                    className="generate-alert generate-alert-success"
                    role="status"
                >
                    <CheckCircle2 size={20} />
                    <div>
                        <strong>
                            {savedScheduleId ? 'Draft Saved' : 'Result'}
                        </strong>
                        <p>{notice}</p>
                    </div>
                </div>
            )}

            {savedScheduleId && (
                <button
                    type="button"
                    className="generate-button"
                    onClick={() =>
                        navigate(
                            `/schedule?scheduleId=${encodeURIComponent(
                                savedScheduleId
                            )}`
                        )
                    }
                >
                    <CalendarDays size={19} />
                    View Saved Schedule
                </button>
            )}

            {preview && (
                <>
                    <section className="generate-panel">
                        <div className="generate-results-heading">
                            <div>
                                <span className="generate-eyebrow">
                                    GENERATION SUMMARY
                                </span>
                                <h2>Generation Results</h2>
                                <p>
                                    Review the generated assignments before
                                    saving your draft.
                                </p>
                            </div>

                            <span
                                className={`generate-status ${
                                    unscheduledCount === 0 &&
                                    scheduledCount > 0
                                        ? 'generate-status-success'
                                        : 'generate-status-warning'
                                }`}
                            >
                                {scheduledCount > 0 &&
                                unscheduledCount === 0
                                    ? 'All exams scheduled'
                                    : unscheduledCount > 0
                                      ? 'Review required'
                                      : 'No exams assigned'}
                            </span>
                        </div>

                        <div className="generate-summary-grid">
                            <article className="generate-summary-card">
                                <div className="generate-summary-icon generate-summary-icon-blue">
                                    <CalendarDays size={22} />
                                </div>

                                <div>
                                    <p className="generate-summary-label">
                                        Scheduled Exams
                                    </p>
                                    <h3 className="generate-summary-value">
                                        {scheduledCount}
                                    </h3>
                                    <span className="generate-summary-caption">
                                        Successfully assigned
                                    </span>
                                </div>
                            </article>

                            <article className="generate-summary-card">
                                <div className="generate-summary-icon generate-summary-icon-orange">
                                    <AlertTriangle size={22} />
                                </div>

                                <div>
                                    <p className="generate-summary-label">
                                        Unscheduled Exams
                                    </p>
                                    <h3 className="generate-summary-value">
                                        {unscheduledCount}
                                    </h3>
                                    <span className="generate-summary-caption">
                                        Need further review
                                    </span>
                                </div>
                            </article>
                        </div>

                        {preview.strategy && (
                            <div className="generate-strategy">
                                <strong>Generation strategy</strong>
                                <p>
                                    {typeof preview.strategy === 'string'
                                        ? preview.strategy
                                        : JSON.stringify(preview.strategy)}
                                </p>
                            </div>
                        )}

                        {scheduledCount === 0 &&
                            unscheduledCount === 0 && (
                                <div className="generate-alert generate-alert-warning">
                                    <AlertTriangle size={20} />
                                    <div>
                                        <strong>
                                            No scheduling results returned
                                        </strong>
                                        <p>
                                            The request succeeded, but the
                                            preview contains no assignments
                                            or unscheduled exams. Check the
                                            exam period and backend preview
                                            response.
                                        </p>
                                    </div>
                                </div>
                            )}

                        {unscheduledCount > 0 && (
                            <div className="generate-alert generate-alert-warning">
                                <AlertTriangle size={20} />
                                <div>
                                    <strong>
                                        Some exams could not be scheduled
                                    </strong>
                                    <p>
                                        Review the unscheduled exam list
                                        and resolve room, time-slot, or
                                        scheduling conflicts.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="generate-actions">
                            <button
                                type="button"
                                className="generate-button"
                                onClick={handleSaveDraft}
                                disabled={
                                    saving || allocations.length === 0
                                }
                            >
                                {saving ? (
                                    <LoaderCircle
                                        className="generate-spinner"
                                        size={19}
                                    />
                                ) : (
                                    <Save size={19} />
                                )}

                                {saving
                                    ? 'Saving Draft...'
                                    : 'Save Draft'}
                            </button>

                            <span className="generate-action-help">
                                Saving creates a draft; it does not
                                publish the timetable.
                            </span>
                        </div>
                    </section>

                    <section className="generate-panel">
                        <div className="generate-section-heading">
                            <div className="generate-panel-icon">
                                <CalendarDays size={22} />
                            </div>

                            <div>
                                <h2>Scheduled Exams</h2>
                                <p>
                                    Review the date, time, course, and room
                                    for each exam.
                                </p>
                            </div>

                            <span className="generate-count">
                                {allocations.length} exams
                            </span>
                        </div>

                        {allocations.length === 0 ? (
                            <div className="generate-empty">
                                <CalendarDays size={38} />
                                <h3>No scheduled exams</h3>
                                <p>
                                    The generator did not assign any exams
                                    in this preview.
                                </p>
                            </div>
                        ) : (
                            <div className="generate-table-wrap">
                                <table className="generate-table">
                                    <thead>
                                        <tr>
                                            <th>Exam</th>
                                            <th>Course</th>
                                            <th>Date</th>
                                            <th>Start</th>
                                            <th>End</th>
                                            <th>Room</th>
                                            <th>Enrollment / Capacity</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {allocations.map((item, index) => (
                                            <tr
                                                key={`${
                                                    item.examId ??
                                                    item.exam?.id ??
                                                    'exam'
                                                }-${index}`}
                                            >
                                                <td>
                                                    <span className="generate-table-primary">
                                                        {getExamName(item, index)}
                                                    </span>
                                                    <span className="generate-table-secondary">
                                                        ID:{' '}
                                                        {item.examId ??
                                                            item.exam?.id ??
                                                            '-'}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-table-primary">
                                                        {item.exam?.courseCode ||
                                                            item.courseCode ||
                                                            '-'}
                                                    </span>
                                                    <span className="generate-table-secondary">
                                                        {item.exam?.courseTitle ||
                                                            item.courseTitle ||
                                                            ''}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-table-nowrap">
                                                        {formatDate(
                                                            item.examDate ??
                                                            item.date
                                                        )}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-time">
                                                        <Clock3 size={14} />
                                                        {formatTime(
                                                            item.startTime ||
                                                            item.timeSlot?.startTime
                                                        )}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-time">
                                                        <Clock3 size={14} />
                                                        {formatTime(
                                                            item.endTime ||
                                                            item.timeSlot?.endTime
                                                        )}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-table-primary">
                                                        {item.room?.name ||
                                                            item.roomName ||
                                                            'Room unavailable'}
                                                    </span>

                                                    {(item.room?.buildingCode ||
                                                        item.room?.building?.name) && (
                                                        <span className="generate-table-secondary">
                                                            <MapPin size={12} />
                                                            {item.room?.buildingCode ||
                                                                item.room?.building?.name}
                                                        </span>
                                                    )}
                                                </td>

                                                <td>
                                                    <span className="generate-enrollment">
                                                        {item.exam?.enrollmentCount ??
                                                            item.candidateCount ??
                                                            '-'}
                                                        {' / '}
                                                        {item.room?.capacity ??
                                                            item.roomCapacity ??
                                                            '-'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="generate-panel">
                        <div className="generate-section-heading">
                            <div className="generate-panel-icon generate-panel-icon-warning">
                                <AlertTriangle size={22} />
                            </div>

                            <div>
                                <h2>Unscheduled Exams</h2>
                                <p>
                                    Exams that need another available room
                                    or time slot.
                                </p>
                            </div>

                            <span
                                className={`generate-count ${
                                    unscheduled.length > 0
                                        ? 'generate-count-warning'
                                        : ''
                                }`}
                            >
                                {unscheduled.length} exams
                            </span>
                        </div>

                        {unscheduled.length === 0 ? (
                            <div className="generate-empty generate-empty-success">
                                <CheckCircle2 size={38} />
                                <h3>
                                    {scheduledCount > 0
                                        ? 'All exams have been assigned'
                                        : 'No unscheduled exams reported'}
                                </h3>
                                <p>
                                    {scheduledCount > 0
                                        ? 'No unscheduled exams were reported in this preview.'
                                        : 'The backend did not return any unscheduled exam details.'}
                                </p>
                            </div>
                        ) : (
                            <div className="generate-unscheduled-list">
                                {unscheduled.map((item, index) => (
                                    <article
                                        className="generate-unscheduled-item"
                                        key={
                                            item.examId ??
                                            item.exam?.id ??
                                            index
                                        }
                                    >
                                        <div className="generate-unscheduled-icon">
                                            <AlertTriangle size={20} />
                                        </div>

                                        <div className="generate-unscheduled-content">
                                            <h3>
                                                {item.exam?.title ||
                                                    item.exam?.courseTitle ||
                                                    item.exam?.courseCode ||
                                                    item.examTitle ||
                                                    `Exam ${index + 1}`}
                                            </h3>

                                            <p>
                                                {getUnscheduledReason(item)}
                                            </p>

                                            {(item.exam?.courseCode ||
                                                item.courseCode) && (
                                                <span className="generate-unscheduled-code">
                                                    {item.exam?.courseCode ||
                                                        item.courseCode}
                                                </span>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                </>
            )}
        </main>
    );
}
