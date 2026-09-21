import logoImage from '../assets/image/logo.png';

const brandTitle = import.meta.env.VITE_TITLE || 'Nodexa RMM';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-logo ${compact ? 'is-compact' : ''}`} aria-label={brandTitle}>
      <img className="brand-mark" src={logoImage} alt="" />
      {!compact && <span className="brand-wordmark">{brandTitle}</span>}
    </div>
  );
}