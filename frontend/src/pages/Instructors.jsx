
import { useCallback, useEffect, useState } from 'react';
import {
  Users,
  UserRoundCheck,
  ClipboardList,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  Building2,
  Clock,
} from 'lucide-react';
import api from '../services/api';
import instructorService from '../services/instructorService';
import invigilatorService from '../services/invigilatorService';
import invigilationService from '../services/invigilationService';
import '../styles/instructors.css';

const EMPTY_INSTRUCTOR = {
  userId: '',
  staffNumber: '',
  departmentId: '',
  title: '',
  expertise: '',
  maxLoadHours: '12',
  isActive: true,
};

const EMPTY_INVIGILATOR = {
  userId: '',
  staffIdentifier: '',
  departmentId: '',
  instructorId: '',
  maxDutiesPerDay: '2',
  maxDutiesPerPeriod: '10',
  phone: '',
  qualification: '',
  notes: '',
  isActive: true,
};

function getItems(payload, keys = []) {
  let current = payload;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (Array.isArray(current)) return current;

    for (const key of keys) {
      if (Array.isArray(current[key])) return current[key];
    }

    if (Array.isArray(current.items)) return current.items;
    current = current.data;
  }

  return [];
}

function getObject(payload, key) {
  let current = payload;

  for (let depth = 0; depth < 6 && current; depth += 1) {
    if (current[key] && typeof current[key] === 'object') {
      return current[key];
    }
    current = current.data;
  }

  return null;
}

function getError(error) {
  if (error?.details?.length) {
    return error.details.map((item) => item.message).filter(Boolean).join(' ');
  }
  return error?.message || 'The request failed. Please try again.';
}

function Status({ active }) {
  return (
    <span className={`instructors-status ${active ? 'is-active' : 'is-inactive'}`}>
      <span />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function Notice({ notice, dismiss }) {
  if (!notice) return null;

  return (
    <div className={`instructors-notice ${notice.type}`} role="status">
      {notice.type === 'success'
        ? <CheckCircle2 size={18} />
        : <AlertCircle size={18} />}
      <span>{notice.text}</span>
      <button type="button" onClick={dismiss} aria-label="Dismiss message">
        <X size={16} />
      </button>
    </div>
  );
}

export default function Instructors() {
  const [tab, setTab] = useState('instructors');
  const [instructors, setInstructors] = useState([]);
  const [invigilators, setInvigilators] = useState([]);
  const [duties, setDuties] = useState([]);
  const [unfilled, setUnfilled] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [notice, setNotice] = useState(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_INSTRUCTOR);

  const isInstructorTab = tab === 'instructors';

  const loadDirectory = useCallback(async () => {
    setLoading(true);

    try {
      const params = {
        limit: 100,
        search: search || undefined,
        isActive: statusFilter === '' ? undefined : statusFilter === 'active',
        order: 'asc',
      };

      const result = isInstructorTab
        ? await instructorService.list(params)
        : await invigilatorService.list(params);

      if (isInstructorTab) {
        setInstructors(getItems(result, ['instructors']));
      } else {
        setInvigilators(getItems(result, ['invigilators']));
      }

      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    } finally {
      setLoading(false);
    }
  }, [isInstructorTab, search, statusFilter]);

  const loadDuties = useCallback(async () => {
    setLoading(true);

    const results = await Promise.allSettled([
      invigilationService.duties({ limit: 100 }),
      invigilationService.unfilled({ limit: 100 }),
      invigilationService.workload({ limit: 100 }),
    ]);

    if (results[0].status === 'fulfilled') {
      setDuties(getItems(results[0].value, ['duties']));
    }

    if (results[1].status === 'fulfilled') {
      setUnfilled(getItems(results[1].value, ['items', 'unfilled', 'details']));
    }

    if (results[2].status === 'fulfilled') {
      setWorkload(getItems(results[2].value, ['workload', 'items']));
    }

    const failures = results.filter((result) => result.status === 'rejected');

    if (failures.length) {
      setNotice({
        type: 'error',
        text: 'Some duty information could not be loaded. Check your permissions and API availability.',
      });
    } else {
      setNotice(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const [userResult, departmentResult] = await Promise.all([
          api.get('/users', { params: { limit: 100, role: 'instructor' } }),
          api.get('/departments', { params: { limit: 100, isActive: true } }),
        ]);

        if (!cancelled) {
          setUsers(getItems(userResult, ['users']).filter(
            (user) => user.role === 'instructor' && user.isActive !== false,
          ));
          setDepartments(getItems(departmentResult, ['departments']).filter(
            (department) => department.isActive !== false,
          ));
        }
      } catch {
        if (!cancelled) {
          setNotice({
            type: 'error',
            text: 'Could not load user or department options. You can still review existing records.',
          });
        }
      }
    }

    loadOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (tab === 'duties') {
      loadDuties();
    } else {
      loadDirectory();
    }
  }, [tab, loadDirectory, loadDuties]);

  function openCreate() {
    setEditing(null);
    setForm(isInstructorTab ? { ...EMPTY_INSTRUCTOR } : { ...EMPTY_INVIGILATOR });
    setNotice(null);
    setFormOpen(true);
  }

  function openEdit(record) {
    setEditing(record);

    if (isInstructorTab) {
      setForm({
        userId: record.user?.id ? String(record.user.id) : '',
        staffNumber: record.staffNumber || '',
        departmentId: record.department?.id ? String(record.department.id) : '',
        title: record.title || '',
        expertise: record.expertise || '',
        maxLoadHours: String(record.maxLoadHours ?? 12),
        isActive: record.isActive !== false,
      });
    } else {
      setForm({
        userId: String(record.userId ?? record.user?.id ?? ''),
        staffIdentifier: record.staffIdentifier || '',
        departmentId: String(record.departmentId ?? record.department?.id ?? ''),
        instructorId: String(record.instructorId ?? record.instructor?.id ?? ''),
        maxDutiesPerDay: String(record.maxDutiesPerDay ?? 2),
        maxDutiesPerPeriod: String(record.maxDutiesPerPeriod ?? 10),
        phone: record.phone || '',
        qualification: record.qualification || '',
        notes: record.notes || '',
        isActive: record.isActive !== false,
      });
    }

    setNotice(null);
    setFormOpen(true);
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;
    setForm((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      if (isInstructorTab) {
        const payload = {
          staffNumber: form.staffNumber.trim() || null,
          departmentId: form.departmentId ? Number(form.departmentId) : null,
          title: form.title.trim() || null,
          expertise: form.expertise.trim() || null,
          maxLoadHours: Number(form.maxLoadHours),
          isActive: Boolean(form.isActive),
        };

        if (editing) {
          await instructorService.update(editing.id, payload);
        } else {
          payload.userId = Number(form.userId);
          await instructorService.create(payload);
        }
      } else {
        const payload = {
          staffIdentifier: form.staffIdentifier.trim(),
          departmentId: form.departmentId ? Number(form.departmentId) : null,
          instructorId: form.instructorId ? Number(form.instructorId) : null,
          maxDutiesPerDay: Number(form.maxDutiesPerDay),
          maxDutiesPerPeriod: Number(form.maxDutiesPerPeriod),
          phone: form.phone.trim() || null,
          qualification: form.qualification.trim() || null,
          notes: form.notes.trim() || null,
          isActive: Boolean(form.isActive),
        };

        if (editing) {
          await invigilatorService.update(editing.id, payload);
        } else {
          payload.userId = Number(form.userId);
          await invigilatorService.create(payload);
        }
      }

      setNotice({
        type: 'success',
        text: `${isInstructorTab ? 'Instructor' : 'Invigilator'} ${editing ? 'updated' : 'created'} successfully.`,
      });
      setFormOpen(false);
      await loadDirectory();
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(record) {
    const label = record.user?.fullName || record.staffIdentifier || record.staffNumber || 'this record';
    const nextStatus = !record.isActive;

    if (!window.confirm(`Set ${label} to ${nextStatus ? 'active' : 'inactive'}?`)) {
      return;
    }

    setNotice(null);

    try {
      if (isInstructorTab) {
        await instructorService.setStatus(record.id, nextStatus);
      } else {
        await invigilatorService.setStatus(record.id, nextStatus);
      }

      setNotice({ type: 'success', text: 'Status updated successfully.' });
      await loadDirectory();
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  const activeCount = (isInstructorTab ? instructors : invigilators)
    .filter((item) => item.isActive !== false).length;

  const currentRecords = isInstructorTab ? instructors : invigilators;

  return (
    <div className="page instructors-page">
      <header className="page-header instructors-header">
        <div>
          <div className="instructors-eyebrow">
            <Users size={16} />
            ACADEMIC OPERATIONS
          </div>
          <h1>Instructors &amp; Duties</h1>
          <p>Manage teaching staff, exam invigilators, and examination duty information.</p>
        </div>

        <div className="instructors-header-actions">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={tab === 'duties' ? loadDuties : loadDirectory}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'instructors-spin' : ''} />
            Refresh
          </button>

          {tab !== 'duties' && (
            <button className="btn btn-primary" type="button" onClick={openCreate}>
              <Plus size={17} />
              Add {isInstructorTab ? 'instructor' : 'invigilator'}
            </button>
          )}
        </div>
      </header>

      <Notice notice={notice} dismiss={() => setNotice(null)} />

      <section className="instructors-stats">
        <article className="instructors-stat-card">
          <div className="instructors-stat-icon purple"><Users size={21} /></div>
          <div>
            <span>{isInstructorTab ? 'Instructors shown' : 'Invigilators shown'}</span>
            <strong>{tab === 'duties' ? '—' : loading ? '—' : currentRecords.length}</strong>
          </div>
        </article>

        <article className="instructors-stat-card">
          <div className="instructors-stat-icon green"><UserRoundCheck size={21} /></div>
          <div>
            <span>Active records shown</span>
            <strong>{tab === 'duties' || loading ? '—' : activeCount}</strong>
          </div>
        </article>

        <article className="instructors-stat-card">
          <div className="instructors-stat-icon blue"><ClipboardList size={21} /></div>
          <div>
            <span>Unfilled duty records</span>
            <strong>{tab === 'duties' && !loading ? unfilled.length : '—'}</strong>
          </div>
        </article>
      </section>

      <nav className="instructors-tabs" aria-label="Instructor and duty sections">
        <button
          type="button"
          className={tab === 'instructors' ? 'active' : ''}
          onClick={() => setTab('instructors')}
        >
          <Users size={17} /> Instructors
        </button>
        <button
          type="button"
          className={tab === 'invigilators' ? 'active' : ''}
          onClick={() => setTab('invigilators')}
        >
          <UserRoundCheck size={17} /> Invigilators
        </button>
        <button
          type="button"
          className={tab === 'duties' ? 'active' : ''}
          onClick={() => setTab('duties')}
        >
          <ClipboardList size={17} /> Exam duties
        </button>
      </nav>

      {tab !== 'duties' ? (
        <section className="card instructors-panel">
          <div className="instructors-toolbar">
            <form className="instructors-search" onSubmit={submitSearch}>
              <Search size={18} />
              <input
                aria-label={`Search ${tab}`}
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={isInstructorTab
                  ? 'Search staff number, name, or expertise...'
                  : 'Search invigilators...'}
              />
              <button className="btn btn-primary" type="submit">Search</button>
            </form>

            <select
              className="input instructors-status-filter"
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="instructors-table-heading">
            <div>
              <h2>{isInstructorTab ? 'Instructor directory' : 'Invigilator directory'}</h2>
              <p>
                {isInstructorTab
                  ? 'Teaching staff profiles and departmental assignments.'
                  : 'Exam supervision profiles and duty limits.'}
              </p>
            </div>
            <span>{loading ? 'Loading…' : `${currentRecords.length} shown`}</span>
          </div>

          <div className="table-wrap">
            <table className="table instructors-table">
              <thead>
                <tr>
                  <th>Staff member</th>
                  <th>{isInstructorTab ? 'Department / expertise' : 'Staff identifier'}</th>
                  <th>{isInstructorTab ? 'Teaching load' : 'Duty limits'}</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5"><div className="instructors-loading"><span className="spinner" /> Loading records…</div></td></tr>
                ) : currentRecords.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="empty-state">
                        <div className="empty-state-icon"><Users size={24} /></div>
                        <div className="empty-state-title">No records found</div>
                        <p>Try another search or add a new staff record.</p>
                        <button className="btn btn-primary" type="button" onClick={openCreate}>
                          <Plus size={16} /> Add record
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : currentRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="instructors-person">
                        <div className="instructors-avatar">
                          {(record.user?.fullName || record.staffIdentifier || '?').trim().charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{record.user?.fullName || 'User name unavailable'}</strong>
                          <span>{record.staffNumber || record.staffIdentifier || 'No staff number'}</span>
                          <small>{record.user?.email || record.phone || 'No contact information'}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      {isInstructorTab ? (
                        <div className="instructors-secondary">
                          <strong>{record.department?.code || '—'}</strong>
                          <span>{record.department?.name || 'No department assigned'}</span>
                          <small>{record.expertise || record.title || 'No expertise specified'}</small>
                        </div>
                      ) : (
                        <div className="instructors-secondary">
                          <strong>{record.staffIdentifier}</strong>
                          <span>{record.department?.name || 'No department assigned'}</span>
                          <small>{record.qualification || 'Qualification not specified'}</small>
                        </div>
                      )}
                    </td>
                    <td>
                      {isInstructorTab
                        ? `${record.maxLoadHours ?? 12} hours`
                        : `${record.maxDutiesPerDay ?? 2} / day · ${record.maxDutiesPerPeriod ?? 10} / period`}
                    </td>
                    <td><Status active={record.isActive !== false} /></td>
                    <td>
                      <div className="instructors-row-actions">
                        <button
                          className="btn btn-icon"
                          type="button"
                          title="Edit record"
                          aria-label={`Edit ${record.user?.fullName || 'staff record'}`}
                          onClick={() => openEdit(record)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="btn btn-icon"
                          type="button"
                          title={record.isActive === false ? 'Activate record' : 'Deactivate record'}
                          aria-label={record.isActive === false ? 'Activate record' : 'Deactivate record'}
                          onClick={() => changeStatus(record)}
                        >
                          {record.isActive === false
                            ? <CheckCircle2 size={16} />
                            : <XCircle size={16} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="instructors-table-footer">
            Showing up to 100 records for the current filters.
          </footer>
        </section>
      ) : (
        <div className="instructors-duty-layout">
          <section className="card instructors-panel">
            <div className="instructors-table-heading">
              <div>
                <h2>Assigned exam duties</h2>
                <p>Duty records returned by the examination scheduling API.</p>
              </div>
              <Clock size={20} />
            </div>
            <div className="table-wrap">
              <table className="table instructors-table">
                <thead>
                  <tr><th>Duty</th><th>Invigilator</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="3">Loading duties…</td></tr>
                  ) : duties.length === 0 ? (
                    <tr><td colSpan="3">No duty records returned.</td></tr>
                  ) : duties.map((duty) => (
                    <tr key={duty.id}>
                      <td>
                        <strong>{duty.examTitle || duty.exam?.title || `Duty #${duty.id}`}</strong>
                        <small>{duty.examDate || duty.date || 'Date not available'}</small>
                      </td>
                      <td>{duty.invigilator?.user?.fullName || duty.invigilatorName || 'Unassigned'}</td>
                      <td><span className="badge badge-neutral">{duty.status || 'Recorded'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card instructors-panel">
            <div className="instructors-table-heading">
              <div>
                <h2>Unfilled duties</h2>
                <p>Exam details that still need supervision, when returned by the API.</p>
              </div>
              <AlertCircle size={20} />
            </div>
            {loading ? (
              <div className="instructors-loading"><span className="spinner" /> Loading…</div>
            ) : unfilled.length === 0 ? (
              <div className="instructors-empty-compact">
                <CheckCircle2 size={20} />
                No unfilled duty records returned.
              </div>
            ) : (
              <div className="instructors-list">
                {unfilled.map((item, index) => (
                  <article className="instructors-list-item" key={item.id || item.detailId || index}>
                    <strong>{item.examTitle || item.title || `Exam detail ${item.detailId || item.id || index + 1}`}</strong>
                    <span>{item.examDate || item.date || 'Date not available'}</span>
                    <small>{item.missing ?? item.requiredCount ?? 'Review required'} outstanding</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card instructors-panel instructors-workload">
            <div className="instructors-table-heading">
              <div>
                <h2>Invigilator workload</h2>
                <p>Workload data returned by the backend.</p>
              </div>
              <Building2 size={20} />
            </div>
            {loading ? (
              <div className="instructors-loading"><span className="spinner" /> Loading…</div>
            ) : workload.length === 0 ? (
              <p className="instructors-muted">No workload data returned.</p>
            ) : (
              <div className="instructors-workload-grid">
                {workload.map((item, index) => (
                  <article key={item.invigilatorId || item.id || index}>
                    <strong>{item.fullName || item.name || item.staffIdentifier || `Staff ${index + 1}`}</strong>
                    <span>{item.totalDuties ?? item.dutyCount ?? item.assignedCount ?? 0} duties</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {formOpen && (
        <div
          className="instructors-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) setFormOpen(false);
          }}
        >
          <section className="instructors-modal" role="dialog" aria-modal="true" aria-labelledby="instructor-form-title">
            <div className="instructors-modal-header">
              <div>
                <span className="instructors-eyebrow">STAFF MANAGEMENT</span>
                <h2 id="instructor-form-title">
                  {editing ? 'Edit' : 'Add'} {isInstructorTab ? 'instructor' : 'invigilator'}
                </h2>
                <p>Enter the staff details and review the limits before saving.</p>
              </div>
              <button className="btn btn-icon" type="button" onClick={() => setFormOpen(false)} disabled={saving} aria-label="Close form">
                <X size={18} />
              </button>
            </div>

            <form className="instructors-form" onSubmit={submitForm}>
              {!editing && (
                <label className="field">
                  <span className="field-label">Existing instructor user *</span>
                  <select className="input" name="userId" value={form.userId} onChange={updateField} required disabled={saving}>
                    <option value="">Select an existing user…</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName || user.username || `User ${user.id}`} — {user.email || 'No email'}
                      </option>
                    ))}
                  </select>
                  <small>Select a user with the instructor role. Create user accounts in User Management first.</small>
                </label>
              )}

              {isInstructorTab ? (
                <>
                  <label className="field">
                    <span className="field-label">Staff number</span>
                    <input className="input" name="staffNumber" value={form.staffNumber} onChange={updateField} maxLength={30} placeholder="e.g. INST-2026-001" disabled={saving} />
                  </label>

                  <label className="field">
                    <span className="field-label">Department</span>
                    <select className="input" name="departmentId" value={form.departmentId} onChange={updateField} disabled={saving}>
                      <option value="">No department assigned</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code ? `${department.code} — ` : ''}{department.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="instructors-form-grid">
                    <label className="field">
                      <span className="field-label">Academic title</span>
                      <input className="input" name="title" value={form.title} onChange={updateField} maxLength={120} placeholder="e.g. Lecturer" disabled={saving} />
                    </label>
                    <label className="field">
                      <span className="field-label">Maximum teaching load (hours)</span>
                      <input className="input" type="number" name="maxLoadHours" value={form.maxLoadHours} onChange={updateField} min="0" max="40" required disabled={saving} />
                    </label>
                  </div>

                  <label className="field">
                    <span className="field-label">Expertise</span>
                    <input className="input" name="expertise" value={form.expertise} onChange={updateField} maxLength={255} placeholder="e.g. Software Engineering, Databases" disabled={saving} />
                  </label>
                </>
              ) : (
                <>
                  <label className="field">
                    <span className="field-label">Staff identifier *</span>
                    <input className="input" name="staffIdentifier" value={form.staffIdentifier} onChange={updateField} required minLength={2} maxLength={40} pattern="[A-Za-z0-9._/-]+" placeholder="e.g. INV-2026-001" disabled={saving} />
                  </label>

                  <label className="field">
                    <span className="field-label">Department</span>
                    <select className="input" name="departmentId" value={form.departmentId} onChange={updateField} disabled={saving}>
                      <option value="">No department assigned</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.code ? `${department.code} — ` : ''}{department.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span className="field-label">Linked instructor profile (optional)</span>
                    <select className="input" name="instructorId" value={form.instructorId} onChange={updateField} disabled={saving}>
                      <option value="">Not linked</option>
                      {instructors.map((instructor) => (
                        <option key={instructor.id} value={instructor.id}>
                          {instructor.user?.fullName || instructor.staffNumber || `Instructor ${instructor.id}`}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="instructors-form-grid">
                    <label className="field">
                      <span className="field-label">Maximum duties per day</span>
                      <input className="input" type="number" name="maxDutiesPerDay" value={form.maxDutiesPerDay} onChange={updateField} min="0" max="50" required disabled={saving} />
                    </label>
                    <label className="field">
                      <span className="field-label">Maximum duties per period</span>
                      <input className="input" type="number" name="maxDutiesPerPeriod" value={form.maxDutiesPerPeriod} onChange={updateField} min="0" max="500" required disabled={saving} />
                    </label>
                  </div>

                  <div className="instructors-form-grid">
                    <label className="field">
                      <span className="field-label">Phone</span>
                      <input className="input" name="phone" value={form.phone} onChange={updateField} maxLength={30} disabled={saving} />
                    </label>
                    <label className="field">
                      <span className="field-label">Qualification</span>
                      <input className="input" name="qualification" value={form.qualification} onChange={updateField} maxLength={255} disabled={saving} />
                    </label>
                  </div>

                  <label className="field">
                    <span className="field-label">Notes</span>
                    <textarea className="input" name="notes" value={form.notes} onChange={updateField} rows="3" maxLength={2000} disabled={saving} />
                  </label>
                </>
              )}

              {editing && (
                <label className="instructors-checkbox">
                  <input type="checkbox" name="isActive" checked={Boolean(form.isActive)} onChange={updateField} disabled={saving} />
                  <span>Active record</span>
                </label>
              )}

              <div className="instructors-modal-actions">
                <button className="btn btn-ghost" type="button" onClick={() => setFormOpen(false)} disabled={saving}>
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : editing ? 'Save changes' : 'Create record'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
