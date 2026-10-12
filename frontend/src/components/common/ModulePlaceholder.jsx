import { Info } from 'lucide-react';

/**
 * Shared placeholder for feature modules whose UI / CRUD is not built yet.
 *
 * It is deliberately honest: it lists the capabilities still to be developed
 * and never reads or writes database records. It reuses the shared design
 * primitives (page, panel, badge, prototype-banner) so placeholder pages look
 * consistent with the Dashboard and the implemented Users module.
 */
export default function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  features = [],
  note,
  children = null,
}) {
  return (
    <div className="page">
      <div className="prototype-banner">
        <Info size={16} />
        <span>
          <strong>{title}</strong> is not implemented yet. The list below describes the functionality
          planned for a later phase — this page does not read from or write to the database.
        </span>
      </div>

      <div className="page-header">
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        <span className="badge badge-warning">Planned</span>
      </div>

      <section className="panel">
        <div className="panel-header">
          <h3>
            {Icon ? <Icon size={18} aria-hidden="true" /> : null}
            Planned functionality
          </h3>
        </div>
        <div className="panel-body-padded">
          <ul className="module-feature-list">
            {features.map((feature) => (
              <li key={feature}>
                <span className="module-feature-dot" aria-hidden="true" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>

          {note ? <p className="text-sm text-muted module-placeholder-note">{note}</p> : null}
        </div>
      </section>

      {children}
    </div>
  );
}
