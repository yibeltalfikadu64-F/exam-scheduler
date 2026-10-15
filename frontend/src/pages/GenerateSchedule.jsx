
import { useState } from 'react';
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

export default function GenerateSchedule() {
    const [periodId, setPeriodId] = useState('');
    const [expectedExamId, setExpectedExamId] = useState('');
    const [expectedCount, setExpectedCount] = useState('');
    const [preview, setPreview] = useState(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');

    async function handleGenerate(event) {
        if (
            (expectedExamId !== '' || expectedCount !== '') &&
            (
                !Number.isSafeInteger(Number(expectedExamId)) ||
                Number(expectedExamId) < 1 ||
                !Number.isSafeInteger(Number(expectedCount)) ||
                Number(expectedCount) < 1 ||
                Number(expectedCount) > 100000
            )
        ) {
            setError('Enter a valid Exam ID and a whole candidate count from 1 to 100000.');
            return;
        }
        event.preventDefault();

        if (!periodId || !Number.isInteger(Number(periodId)) || Number(periodId) < 1) {
            setError('Please enter a valid positive exam period ID.');
            return;
        }

        setLoading(true);
        setError('');
        setNotice('');
        setPreview(null);

        try {
            const expectedCandidates = {};

            if (expectedExamId !== '' && expectedCount !== '') {
                expectedCandidates[String(Number(expectedExamId))] =
                    Number(expectedCount);
            }

            const response = await api.post('/scheduling/preview', {
                examPeriodId: Number(periodId),
                expectedCandidates,
            });

            // Supports either an Axios response or an interceptor
            // that already returns the response body.
            const result = response?.data ?? response;

            // Some APIs wrap the payload in a "data" property.
            const payload = result?.data ?? result;

            if (!payload || !Array.isArray(payload.allocations)) {
                throw new Error(
                    payload?.message || 'The server returned an unexpected schedule preview.'
                );
            }

            setPreview(payload);
            setNotice('Schedule preview generated successfully.');
        } catch (err) {
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

        try {
            const allocations = preview.allocations.map((item) => ({
                examId: item.exam?.id,
                roomId: item.room?.id,
                timeSlotId: item.timeSlot?.id,
                examDate: String(item.examDate).slice(0, 10),
            }));

            const invalidAllocation = allocations.some(
                (item) =>
                    !item.examId ||
                    !item.roomId ||
                    !item.timeSlotId ||
                    !item.examDate ||
                    item.examDate === 'undefined'
            );

            if (invalidAllocation) {
                throw new Error(
                    'Some schedule assignments are missing an exam, room, time slot, or date.'
                );
            }

            await api.post('/scheduling/schedules', {
                examPeriodId: Number(periodId),
                name: `Generated Schedule - Period ${periodId}`,
                notes: `Automatically generated schedule. ${preview.unscheduledCount ?? preview.unscheduled?.length ?? 0
                    } exam(s) could not be scheduled.`,
                allocations,
            });

            setNotice(
                'Schedule draft saved successfully. Open Schedule Calendar to view the timetable.'
            );
        } catch (err) {
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
        ? preview.generatedCount ?? allocations.length
        : 0;

    const unscheduledCount = preview
        ? preview.unscheduledCount ?? unscheduled.length
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
                        Automatically generate an exam timetable, review room and time
                        assignments, and save the results as a draft.
                    </p>
                </div>

                <div className="generate-header-icon" aria-hidden="true">
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
                            Choose an existing, open exam period to begin generating your
                            timetable.
                        </p>
                    </div>
                </div>

                <form className="generate-form" onSubmit={handleGenerate}>
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
                            onChange={(event) => setPeriodId(event.target.value)}
                            placeholder="e.g. 1"
                            disabled={loading}
                        />

                        <p className="generate-help">
                            Enter the ID of an existing, open exam period. The backend
                            will calculate a timetable using the available exams, rooms,
                            and time slots.
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="generate-button"
                        disabled={
                            loading ||
                            !periodId ||
                            !Number.isInteger(Number(periodId)) ||
                            Number(periodId) < 1
                        }
                    >
                        {loading ? (
                            <LoaderCircle className="generate-spinner" size={19} />
                        ) : (
                            <WandSparkles size={19} />
                        )}

                        {loading ? 'Generating Schedule...' : 'Generate Schedule'}
                    </button>
                </form>
            </section>

            {error && (
                <div className="generate-alert generate-alert-error" role="alert">
                    <AlertTriangle size={20} />
                    <div>
                        <strong>Something went wrong</strong>
                        <p>{error}</p>
                    </div>
                </div>
            )}

            {notice && (
                <div className="generate-alert generate-alert-success" role="status">
                    <CheckCircle2 size={20} />
                    <div>
                        <strong>Success</strong>
                        <p>{notice}</p>
                    </div>
                </div>
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
                                    Review the generated assignments before saving your draft.
                                </p>
                            </div>

                            <span
                                className={`generate-status ${unscheduledCount === 0
                                    ? 'generate-status-success'
                                    : 'generate-status-warning'
                                    }`}
                            >
                                {unscheduledCount === 0
                                    ? 'All exams scheduled'
                                    : 'Review required'}
                            </span>
                        </div>

                        <div className="generate-summary-grid">
                            <article className="generate-summary-card">
                                <div className="generate-summary-icon generate-summary-icon-blue">
                                    <CalendarDays size={22} />
                                </div>

                                <div>
                                    <p className="generate-summary-label">Scheduled Exams</p>
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
                                    <p className="generate-summary-label">Unscheduled Exams</p>
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

                        {unscheduledCount > 0 && (
                            <div className="generate-alert generate-alert-warning">
                                <AlertTriangle size={20} />
                                <div>
                                    <strong>Some exams could not be scheduled</strong>
                                    <p>
                                        Review the unscheduled exam list and resolve any room,
                                        time-slot, or scheduling conflicts before finalizing.
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="generate-actions">
                            <button
                                type="button"
                                className="generate-button"
                                onClick={handleSaveDraft}
                                disabled={saving || allocations.length === 0}
                            >
                                {saving ? (
                                    <LoaderCircle className="generate-spinner" size={19} />
                                ) : (
                                    <Save size={19} />
                                )}

                                {saving ? 'Saving Draft...' : 'Save Draft'}
                            </button>

                            <span className="generate-action-help">
                                Saving creates a draft; it does not publish the timetable.
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
                                    Review the date, time, course, and room for each exam.
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
                                    The generator did not assign any exams in this preview.
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
                                            <tr key={`${item.exam?.id ?? 'exam'}-${index}`}>
                                                <td>
                                                    <span className="generate-table-primary">
                                                        {getExamName(item, index)}
                                                    </span>
                                                    <span className="generate-table-secondary">
                                                        ID: {item.exam?.id ?? '-'}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-table-primary">
                                                        {item.exam?.courseCode || '-'}
                                                    </span>
                                                    <span className="generate-table-secondary">
                                                        {item.exam?.courseTitle || ''}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-table-nowrap">
                                                        {formatDate(item.examDate)}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-time">
                                                        <Clock3 size={14} />
                                                        {formatTime(
                                                            item.startTime || item.timeSlot?.startTime
                                                        )}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-time">
                                                        <Clock3 size={14} />
                                                        {formatTime(
                                                            item.endTime || item.timeSlot?.endTime
                                                        )}
                                                    </span>
                                                </td>

                                                <td>
                                                    <span className="generate-table-primary">
                                                        {item.room?.name || 'Room unavailable'}
                                                    </span>

                                                    {item.room?.buildingCode && (
                                                        <span className="generate-table-secondary">
                                                            <MapPin size={12} />
                                                            {item.room.buildingCode}
                                                        </span>
                                                    )}
                                                </td>

                                                <td>
                                                    <span className="generate-enrollment">
                                                        {item.exam?.enrollmentCount ?? '-'}
                                                        {' / '}
                                                        {item.room?.capacity ?? '-'}
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
                                    Exams that need another available room or time slot.
                                </p>
                            </div>

                            <span
                                className={`generate-count ${unscheduled.length > 0
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
                                <h3>All exams have been assigned</h3>
                                <p>
                                    No unscheduled exams were reported in this preview.
                                </p>
                            </div>
                        ) : (
                            <div className="generate-unscheduled-list">
                                {unscheduled.map((item, index) => (
                                    <article
                                        className="generate-unscheduled-item"
                                        key={item.exam?.id ?? index}
                                    >
                                        <div className="generate-unscheduled-icon">
                                            <AlertTriangle size={20} />
                                        </div>

                                        <div className="generate-unscheduled-content">
                                            <h3>
                                                {item.exam?.title ||
                                                    item.exam?.courseTitle ||
                                                    item.exam?.courseCode ||
                                                    `Exam ${index + 1}`}
                                            </h3>

                                            <p>{getUnscheduledReason(item)}</p>

                                            {item.exam?.courseCode && (
                                                <span className="generate-unscheduled-code">
                                                    {item.exam.courseCode}
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
