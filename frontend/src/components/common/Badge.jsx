/**
 * Small presentational badge. Tones map to the .badge-* classes in global.css.
 */
export default function Badge({ tone = 'neutral', children, className = '' }) {
  return <span className={`badge badge-${tone} ${className}`.trim()}>{children}</span>;
}
