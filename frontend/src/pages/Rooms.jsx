import { useCallback, useEffect, useState } from 'react';
import {
  Building2, DoorOpen, Plus, Search, RefreshCw, Pencil,
  CheckCircle2, XCircle, AlertCircle, X, MapPin, Users,
  Layers3, Trash2, Boxes,
} from 'lucide-react';
import buildingService from '../services/buildingService';
import roomService from '../services/roomService';
import '../styles/rooms.css';

const EMPTY_BUILDING = {
  code: '', name: '', address: '', description: '', floors: '1',
};

const EMPTY_ROOM = {
  buildingId: '', name: '', floor: '0', capacity: '',
  type: 'lecture', equipment: '',
};

const ROOM_TYPES = ['lecture', 'lab', 'hall', 'seminar', 'other'];

function unwrap(payload) {
  let current = payload;
  for (let i = 0; i < 6 && current; i += 1) {
    if (current.data && typeof current.data === 'object') {
      current = current.data;
    } else {
      break;
    }
  }
  return current;
}

function getItems(payload, keys = []) {
  const current = unwrap(payload);
  if (Array.isArray(current)) return current;

  for (const key of keys) {
    if (Array.isArray(current?.[key])) return current[key];
  }

  if (Array.isArray(current?.items)) return current.items;
  return [];
}

function getObject(payload, key) {
  const current = unwrap(payload);
  return current?.[key] || null;
}

function getError(error) {
  if (Array.isArray(error?.details) && error.details.length) {
    return error.details.map((item) => item.message).filter(Boolean).join(' ');
  }
  return error?.message || 'The request failed. Please try again.';
}

function Status({ active }) {
  return (
    <span className={`rooms-status ${active ? 'active' : 'inactive'}`}>
      <span />
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function Notice({ notice, dismiss }) {
  if (!notice) return null;
  return (
    <div className={`rooms-notice ${notice.type}`} role="status">
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

export default function Rooms() {
  const [tab, setTab] = useState('rooms');
  const [buildings, setBuildings] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [notice, setNotice] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ROOM);

  const isBuildingsTab = tab === 'buildings';
  const records = isBuildingsTab ? buildings : rooms;

  const loadBuildings = useCallback(async () => {
    const result = await buildingService.list({
      limit: 100,
      search: isBuildingsTab ? search || undefined : undefined,
      isActive: statusFilter === '' ? undefined : statusFilter === 'active',
      sort: 'name',
      order: 'asc',
    });
    setBuildings(getItems(result, ['buildings']));
  }, [isBuildingsTab, search, statusFilter]);

  const loadRooms = useCallback(async () => {
    const params = {
      limit: 100,
      search: search || undefined,
      isActive: statusFilter === '' ? undefined : statusFilter === 'active',
      buildingId: buildingFilter || undefined,
      type: typeFilter || undefined,
      sort: 'name',
      order: 'asc',
    };
    const result = await roomService.list(params);
    setRooms(getItems(result, ['rooms']));
  }, [search, statusFilter, buildingFilter, typeFilter]);

  const loadOptions = useCallback(async () => {
    const result = await buildingService.options();
    setBuildings((previous) => {
      const options = getItems(result, ['buildings']);
      // Preserve the current table until the main list request completes.
      return options.length ? options : previous;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (isBuildingsTab) {
        await loadBuildings();
      } else {
        const [buildingResult, roomResult] = await Promise.all([
          buildingService.list({
            limit: 100,
            isActive: true,
            sort: 'name',
            order: 'asc',
          }),
          roomService.list({
            limit: 100,
            search: search || undefined,
            isActive: statusFilter === '' ? undefined : statusFilter === 'active',
            buildingId: buildingFilter || undefined,
            type: typeFilter || undefined,
            sort: 'name',
            order: 'asc',
          }),
        ]);
        setBuildings(getItems(buildingResult, ['buildings']));
        setRooms(getItems(roomResult, ['rooms']));
      }
      setNotice(null);
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    } finally {
      setLoading(false);
    }
  }, [
    isBuildingsTab, loadBuildings, search, statusFilter,
    buildingFilter, typeFilter,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    loadOptions().catch(() => {
      // The main request displays any relevant API error.
    });
  }, [loadOptions]);

  function openCreate() {
    setEditing(null);
    setForm(isBuildingsTab ? { ...EMPTY_BUILDING } : {
      ...EMPTY_ROOM,
      buildingId: buildingFilter || '',
    });
    setNotice(null);
    setFormOpen(true);
  }

  function openEdit(record) {
    setEditing(record);

    if (isBuildingsTab) {
      setForm({
        code: record.code || '',
        name: record.name || '',
        address: record.address || '',
        description: record.description || '',
        floors: String(record.floors ?? 1),
      });
    } else {
      setForm({
        buildingId: String(record.buildingId ?? record.building?.id ?? ''),
        name: record.name || '',
        floor: String(record.floor ?? 0),
        capacity: String(record.capacity ?? ''),
        type: record.type || 'lecture',
        equipment: record.equipment || '',
      });
    }

    setNotice(null);
    setFormOpen(true);
  }

  function updateField(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    try {
      if (isBuildingsTab) {
        const payload = {
          code: form.code.trim(),
          name: form.name.trim(),
          address: form.address.trim() || null,
          description: form.description.trim() || null,
          floors: form.floors === '' ? 1 : Number(form.floors),
        };

        if (editing) {
          await buildingService.update(editing.id, payload);
        } else {
          await buildingService.create(payload);
        }
      } else {
        const payload = {
          buildingId: Number(form.buildingId),
          name: form.name.trim(),
          floor: form.floor === '' ? 0 : Number(form.floor),
          capacity: Number(form.capacity),
          type: form.type,
          equipment: form.equipment.trim() || null,
        };

        if (editing) {
          await roomService.update(editing.id, payload);
        } else {
          await roomService.create(payload);
        }
      }

      setNotice({
        type: 'success',
        text: `${isBuildingsTab ? 'Building' : 'Room'} ${editing ? 'updated' : 'created'} successfully.`,
      });
      setFormOpen(false);
      await refresh();
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(record) {
    const label = isBuildingsTab
      ? record.name
      : `${record.building?.code || 'Building'} / ${record.name}`;
    const nextStatus = record.isActive === false;

    if (!window.confirm(
      `${nextStatus ? 'Activate' : 'Deactivate'} ${label}?`,
    )) return;

    setNotice(null);
    try {
      if (isBuildingsTab) {
        await buildingService.setStatus(record.id, nextStatus);
      } else {
        await roomService.setStatus(record.id, nextStatus);
      }
      setNotice({ type: 'success', text: 'Status updated successfully.' });
      await refresh();
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    }
  }

  async function deleteRecord(record) {
    const label = isBuildingsTab ? record.name : record.name;
    const kind = isBuildingsTab ? 'building' : 'room';

    if (!window.confirm(
      `Delete ${kind} "${label}"? This cannot be undone.`,
    )) return;

    setNotice(null);
    try {
      if (isBuildingsTab) {
        await buildingService.remove(record.id);
      } else {
        await roomService.remove(record.id);
      }
      setNotice({ type: 'success', text: `${kind} deleted successfully.` });
      await refresh();
    } catch (error) {
      setNotice({ type: 'error', text: getError(error) });
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  const activeCount = records.filter((item) => item.isActive !== false).length;
  const totalCapacity = rooms.reduce(
    (total, room) => total + (Number(room.capacity) || 0), 0,
  );

  return (
    <div className="page rooms-page">
      <header className="page-header rooms-header">
        <div>
          <div className="rooms-eyebrow">
            <Boxes size={16} />
            EXAMINATION RESOURCES
          </div>
          <h1>Buildings &amp; Rooms</h1>
          <p>Manage university buildings, room capacity, and examination spaces.</p>
        </div>
        <div className="rooms-header-actions">
          <button
            className="btn btn-ghost"
            type="button"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'rooms-spin' : ''} />
            Refresh
          </button>
          <button className="btn btn-primary" type="button" onClick={openCreate}>
            <Plus size={17} />
            Add {isBuildingsTab ? 'building' : 'room'}
          </button>
        </div>
      </header>

      <Notice notice={notice} dismiss={() => setNotice(null)} />

      <section className="rooms-stats">
        <article className="rooms-stat card">
          <div className="rooms-stat-icon purple"><Building2 size={21} /></div>
          <div><span>Buildings</span><strong>{buildings.length}</strong></div>
        </article>
        <article className="rooms-stat card">
          <div className="rooms-stat-icon blue"><DoorOpen size={21} /></div>
          <div><span>Rooms</span><strong>{rooms.length}</strong></div>
        </article>
        <article className="rooms-stat card">
          <div className="rooms-stat-icon green"><Users size={21} /></div>
          <div><span>Total room capacity</span><strong>{totalCapacity.toLocaleString()}</strong></div>
        </article>
        <article className="rooms-stat card">
          <div className="rooms-stat-icon amber"><CheckCircle2 size={21} /></div>
          <div><span>Active records shown</span><strong>{loading ? '—' : activeCount}</strong></div>
        </article>
      </section>

      <nav className="rooms-tabs" aria-label="Resource management">
        <button
          type="button"
          className={isBuildingsTab ? 'selected' : ''}
          onClick={() => { setTab('buildings'); setSearch(''); setSearchInput(''); }}
        >
          <Building2 size={17} /> Buildings
        </button>
        <button
          type="button"
          className={!isBuildingsTab ? 'selected' : ''}
          onClick={() => { setTab('rooms'); setSearch(''); setSearchInput(''); }}
        >
          <DoorOpen size={17} /> Rooms
        </button>
      </nav>

      <section className="card rooms-panel">
        <div className="rooms-toolbar">
          <form className="rooms-search" onSubmit={submitSearch}>
            <Search size={18} />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={isBuildingsTab
                ? 'Search building name, code, or address…'
                : 'Search room name or equipment…'}
              aria-label="Search resources"
            />
            <button className="btn btn-primary" type="submit">Search</button>
          </form>

          <select
            className="input rooms-filter"
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          {!isBuildingsTab && (
            <>
              <select
                className="input rooms-filter"
                aria-label="Filter by building"
                value={buildingFilter}
                onChange={(event) => setBuildingFilter(event.target.value)}
              >
                <option value="">All buildings</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.code} — {building.name}
                  </option>
                ))}
              </select>
              <select
                className="input rooms-filter"
                aria-label="Filter by room type"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">All room types</option>
                {ROOM_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className="rooms-table-heading">
          <div>
            <h2>{isBuildingsTab ? 'Building directory' : 'Room directory'}</h2>
            <p>
              {isBuildingsTab
                ? 'Building information and availability for examination planning.'
                : 'Room assignments, seating capacity, type, and availability.'}
            </p>
          </div>
          <span>{loading ? 'Loading…' : `${records.length} shown`}</span>
        </div>

        <div className="table-wrap">
          <table className="table rooms-table">
            {isBuildingsTab ? (
              <>
                <thead>
                  <tr>
                    <th>Building</th><th>Location</th><th>Floors</th>
                    <th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" className="rooms-message">Loading buildings…</td></tr>
                  ) : buildings.length === 0 ? (
                    <tr><td colSpan="5" className="rooms-message">
                      <Building2 size={28} />
                      <strong>No buildings found</strong>
                      <span>Try changing your filters or add a building.</span>
                    </td></tr>
                  ) : buildings.map((building) => (
                    <tr key={building.id}>
                      <td>
                        <div className="rooms-resource">
                          <div className="rooms-resource-icon"><Building2 size={19} /></div>
                          <div>
                            <strong>{building.name}</strong>
                            <span>{building.code}</span>
                            {building.description && <small>{building.description}</small>}
                          </div>
                        </div>
                      </td>
                      <td><span className="rooms-location">
                        <MapPin size={14} /> {building.address || 'Not specified'}
                      </span></td>
                      <td>{building.floors ?? '—'}</td>
                      <td><Status active={building.isActive !== false} /></td>
                      <td><div className="rooms-actions">
                        <button className="btn btn-icon" type="button" title="Edit building"
                          onClick={() => openEdit(building)}><Pencil size={16} /></button>
                        <button className="btn btn-icon" type="button"
                          title={building.isActive === false ? 'Activate' : 'Deactivate'}
                          onClick={() => changeStatus(building)}>
                          {building.isActive === false ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        </button>
                        <button className="btn btn-icon rooms-delete" type="button" title="Delete building"
                          onClick={() => deleteRecord(building)}><Trash2 size={16} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </>
            ) : (
              <>
                <thead>
                  <tr>
                    <th>Room</th><th>Building</th><th>Capacity</th>
                    <th>Type / floor</th><th>Status</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="6" className="rooms-message">Loading rooms…</td></tr>
                  ) : rooms.length === 0 ? (
                    <tr><td colSpan="6" className="rooms-message">
                      <DoorOpen size={28} />
                      <strong>No rooms found</strong>
                      <span>Try changing your filters or add a room.</span>
                    </td></tr>
                  ) : rooms.map((room) => (
                    <tr key={room.id}>
                      <td>
                        <div className="rooms-resource">
                          <div className="rooms-resource-icon room"><DoorOpen size={19} /></div>
                          <div><strong>{room.name}</strong>
                            <span>{room.equipment || 'No equipment specified'}</span></div>
                        </div>
                      </td>
                      <td><div className="rooms-building-cell">
                        <strong>{room.building?.code || '—'}</strong>
                        <span>{room.building?.name || 'Building details unavailable'}</span>
                      </div></td>
                      <td><span className="rooms-capacity"><Users size={15} /> {room.capacity}</span></td>
                      <td><div className="rooms-building-cell">
                        <strong>{room.type || 'lecture'}</strong>
                        <span>Floor {room.floor ?? 0}</span>
                      </div></td>
                      <td><Status active={room.isActive !== false} /></td>
                      <td><div className="rooms-actions">
                        <button className="btn btn-icon" type="button" title="Edit room"
                          onClick={() => openEdit(room)}><Pencil size={16} /></button>
                        <button className="btn btn-icon" type="button"
                          title={room.isActive === false ? 'Activate' : 'Deactivate'}
                          onClick={() => changeStatus(room)}>
                          {room.isActive === false ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        </button>
                        <button className="btn btn-icon rooms-delete" type="button" title="Delete room"
                          onClick={() => deleteRecord(room)}><Trash2 size={16} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>

        <footer className="rooms-footer">
          Showing up to 100 records. Use the filters to narrow the directory.
        </footer>
      </section>

      {formOpen && (
        <div className="rooms-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setFormOpen(false);
        }}>
          <section className="rooms-modal" role="dialog" aria-modal="true"
            aria-labelledby="rooms-form-title">
            <header className="rooms-modal-header">
              <div>
                <span className="rooms-eyebrow">RESOURCE MANAGEMENT</span>
                <h2 id="rooms-form-title">
                  {editing ? 'Edit' : 'Add'} {isBuildingsTab ? 'building' : 'room'}
                </h2>
                <p>Enter the information below and save your changes.</p>
              </div>
              <button className="btn btn-icon" type="button" aria-label="Close form"
                onClick={() => setFormOpen(false)} disabled={saving}><X size={18} /></button>
            </header>

            <form className="rooms-form" onSubmit={submitForm}>
              {isBuildingsTab ? (
                <>
                  <div className="rooms-form-grid">
                    <label className="field">
                      <span className="field-label">Building code *</span>
                      <input className="input" name="code" value={form.code}
                        onChange={updateField} required minLength="2" maxLength="20"
                        pattern="[A-Za-z0-9./_ -]{2,20}" placeholder="e.g. BLK-A"
                        disabled={saving} />
                    </label>
                    <label className="field">
                      <span className="field-label">Building name *</span>
                      <input className="input" name="name" value={form.name}
                        onChange={updateField} required minLength="2" maxLength="150"
                        placeholder="e.g. Engineering Building" disabled={saving} />
                    </label>
                  </div>
                  <label className="field">
                    <span className="field-label">Address / location</span>
                    <input className="input" name="address" value={form.address}
                      onChange={updateField} maxLength="255"
                      placeholder="Campus or location" disabled={saving} />
                  </label>
                  <div className="rooms-form-grid">
                    <label className="field">
                      <span className="field-label">Number of floors</span>
                      <input className="input" type="number" name="floors"
                        value={form.floors} onChange={updateField}
                        min="0" max="100" step="1" disabled={saving} />
                    </label>
                  </div>
                  <label className="field">
                    <span className="field-label">Description</span>
                    <textarea className="input" name="description"
                      value={form.description} onChange={updateField}
                      rows="3" maxLength="2000"
                      placeholder="Optional building details" disabled={saving} />
                  </label>
                </>
              ) : (
                <>
                  <label className="field">
                    <span className="field-label">Building *</span>
                    <select className="input" name="buildingId"
                      value={form.buildingId} onChange={updateField} required disabled={saving}>
                      <option value="">Select a building…</option>
                      {buildings.filter((item) => item.isActive !== false).map((building) => (
                        <option key={building.id} value={building.id}>
                          {building.code} — {building.name}
                        </option>
                      ))}
                    </select>
                    {buildings.length === 0 && (
                      <small>Create an active building before adding rooms.</small>
                    )}
                  </label>
                  <div className="rooms-form-grid">
                    <label className="field">
                      <span className="field-label">Room number / name *</span>
                      <input className="input" name="name" value={form.name}
                        onChange={updateField} required maxLength="50"
                        pattern="[A-Za-z0-9][A-Za-z0-9./_ -]{0,49}"
                        placeholder="e.g. A-101" disabled={saving} />
                    </label>
                    <label className="field">
                      <span className="field-label">Capacity *</span>
                      <input className="input" type="number" name="capacity"
                        value={form.capacity} onChange={updateField}
                        min="1" max="65535" step="1" required
                        placeholder="e.g. 120" disabled={saving} />
                    </label>
                  </div>
                  <div className="rooms-form-grid">
                    <label className="field">
                      <span className="field-label">Room type</span>
                      <select className="input" name="type" value={form.type}
                        onChange={updateField} disabled={saving}>
                        {ROOM_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span className="field-label">Floor</span>
                      <input className="input" type="number" name="floor"
                        value={form.floor} onChange={updateField}
                        min="-10" max="100" step="1" disabled={saving} />
                    </label>
                  </div>
                  <label className="field">
                    <span className="field-label">Equipment / features</span>
                    <input className="input" name="equipment" value={form.equipment}
                      onChange={updateField} maxLength="255"
                      placeholder="e.g. Projector, computers, accessible"
                      disabled={saving} />
                  </label>
                </>
              )}

              <div className="rooms-modal-actions">
                <button className="btn btn-ghost" type="button"
                  onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button>
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