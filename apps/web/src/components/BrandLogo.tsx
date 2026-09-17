export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-logo ${compact ? 'is-compact' : ''}`} aria-label="MeshCentral">
      <div className="brand-shield">
        <span>T</span>
      </div>
      {!compact && <span className="brand-wordmark">MeshCentral</span>}
    </div>
  );
}