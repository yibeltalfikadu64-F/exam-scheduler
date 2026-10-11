export default function LoadingSpinner({ label = 'Loading…', size = 'md', inline = false }) {
  const spinner = <span className={`spinner ${size === 'lg' ? 'spinner-lg' : ''}`} role="status" aria-label={label} />;

  if (inline) return spinner;

  return (
    <div className="loading-block">
      {spinner}
      <span className="text-sm text-muted">{label}</span>
    </div>
  );
}
