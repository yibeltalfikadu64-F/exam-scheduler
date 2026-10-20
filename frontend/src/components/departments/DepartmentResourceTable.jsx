import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, RefreshCw, Search, X } from 'lucide-react';

import EmptyState from '../common/EmptyState';

/**
 * A reusable, read-only, paginated table for department-scoped records.
 *
 * It calls an existing feature endpoint (which already supports a
 * `departmentId` filter) through the shared Axios client and renders whatever
 * columns the caller configures. It has explicit loading, empty and error
 * states so a failed request never masquerades as an empty result.
 *
 * Props:
 *   - fetcher({ ...params, page, limit, search }) => Promise<axios body>
 *   - params: extra query params, e.g. { departmentId }
 *   - columns: [{ key, header, render?(row) }]
 *   - icon / emptyTitle / emptyDescription / searchPlaceholder
 */

const PAGE_SIZE = 10;

function unwrap(response) {
  // The shared Axios instance already strips the HTTP layer, so `response` is
  // the API body { success, message, data }. Fall back safely.
  return response?.data ?? response ?? {};
}

function toList(payload) {
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.departments)) return payload.departments;
  if (Array.isArray(payload)) return payload;
  return [];
}

export default function DepartmentResourceTable({
  fetcher,
  params = {},
  columns,
  title = 'Records',
  icon: Icon,
  emptyTitle = 'No records found',
  emptyDescription,
  searchPlaceholder = 'Search…',
  searchable = true,
}) {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 1,
  });
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const paramsKey = JSON.stringify(params);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');

      try {
        const response = await fetcher({
          ...JSON.parse(paramsKey),
          page,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
        });

        const payload = unwrap(response);
        const list = toList(payload);
        const info = payload?.pagination || {};

        setItems(list);
        setPagination({
          page: Number(info.page ?? page) || 1,
          limit: Number(info.limit ?? PAGE_SIZE) || PAGE_SIZE,
          total: Number(info.total ?? list.length) || 0,
          totalPages:
            Number(
              info.totalPages ??
                Math.max(1, Math.ceil((info.total ?? list.length) / PAGE_SIZE)),
            ) || 1,
        });
      } catch (loadError) {
        setError(loadError?.message || 'Unable to load records.');
        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [fetcher, paramsKey, page, search],
  );

  useEffect(() => {
    load();
  }, [load]);

  function handleSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  function clearSearch() {
    setSearchInput('');
    setSearch('');
    setPage(1);
  }

  const total = pagination.total;
  const firstRow = total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastRow = Math.min(pagination.page * pagination.limit, total);

  return (
    <section className="panel dept-table-panel">
      <div className="panel-header">
        <h3>
          {Icon ? <Icon size={18} /> : null}
          {title}
          <span className="badge badge-neutral">{total}</span>
        </h3>

        <div className="dept-table-tools">
          {searchable && (
            <form className="dept-table-search" onSubmit={handleSearch}>
              <Search size={16} className="dept-table-search-icon" />
              <input
                className="input dept-table-search-input"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
              />
              {searchInput && (
                <button
                  type="button"
                  className="dept-table-search-clear"
                  onClick={clearSearch}
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </form>
          )}

          <button
            type="button"
            className="btn btn-icon"
            onClick={() => load({ silent: true })}
            disabled={refreshing || loading}
            aria-label="Refresh records"
            title="Refresh records"
          >
            <RefreshCw size={16} className={refreshing ? 'dept-spinning' : ''} />
          </button>
        </div>
      </div>

      {error ? (
        <div className="panel-body-padded">
          <div className="notice notice-danger" role="alert">
            {error}
          </div>
          <div style={{ marginTop: 12 }}>
            <button type="button" className="btn btn-ghost" onClick={() => load()}>
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-block">
          <span className="spinner spinner-lg" />
          <span>Loading records…</span>
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Icon}
          title={search ? 'No matching records' : emptyTitle}
          description={
            search
              ? 'Try a different search term or clear the search.'
              : emptyDescription
          }
          action={
            search ? (
              <button type="button" className="btn btn-ghost" onClick={clearSearch}>
                Clear search
              </button>
            ) : null
          }
        />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id ?? row.uuid}>
                    {columns.map((column) => (
                      <td key={column.key}>
                        {column.render ? column.render(row) : (row[column.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="dept-table-footer">
            <span className="text-sm text-muted">
              Showing <strong>{firstRow}</strong>–<strong>{lastRow}</strong> of{' '}
              <strong>{total}</strong>
            </span>

            <div className="dept-table-pager">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={pagination.page <= 1 || loading}
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="dept-table-page">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  setPage((current) => Math.min(pagination.totalPages, current + 1))
                }
                disabled={pagination.page >= pagination.totalPages || loading}
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
