import logoImage from '../assets/image/logo.png';

const brandTitle = import.meta.env.VITE_TITLE || 'Nodexa RMM';

export type BrandLogoVariant = 'sidebar' | 'hero' | 'boot';

export function BrandLogo({
  compact = false,
  variant = 'sidebar',
}: {
  compact?: boolean;
  variant?: BrandLogoVariant;
}) {
  return (
    <div
      className={`brand-logo brand-logo-${variant} ${compact ? 'is-compact' : ''}`}
      aria-label={brandTitle}
    >
      <img className="brand-mark" src={logoImage} alt="" />
      {!compact && <span className="brand-wordmark">{brandTitle}</span>}
    </div>
  );
}