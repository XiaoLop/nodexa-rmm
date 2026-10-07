'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ArrowRight, Globe2, Menu, X } from 'lucide-react';
import type { Locale } from '@/i18n/config';
import type { Dictionary } from '@/i18n/dictionaries';

type SiteHeaderProps = {
  alternateLocale: Locale;
  dictionary: Dictionary;
  actionHref: string;
  actionLabel: string;
  actionExternal?: boolean;
};

const navigationItems = [
  ['#capabilities', 'capabilities'],
  ['#showcase', 'showcase'],
  ['#workflow', 'automation'],
  ['#security', 'security'],
  ['#deployment', 'deployment'],
] as const;

export function SiteHeader({
  alternateLocale,
  dictionary,
  actionHref,
  actionLabel,
  actionExternal = false,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [languageHref, setLanguageHref] = useState(`/${alternateLocale}`);

  useEffect(() => {
    const updateLanguageHref = () => {
      setLanguageHref(`/${alternateLocale}${window.location.hash}`);
    };

    updateLanguageHref();
    window.addEventListener('hashchange', updateLanguageHref);
    return () => window.removeEventListener('hashchange', updateLanguageHref);
  }, [alternateLocale]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const actionProps = actionExternal ? { target: '_blank', rel: 'noreferrer' } : {};

  return (
    <header className="site-header">
      <a className="brand" href="#top" aria-label={dictionary.header.homeLabel} onClick={closeMenu}>
        <span className="brand-mark">
          <Image src="/logo.png" alt="" width={42} height={42} priority />
        </span>
        <span>
          <strong>Nodexa</strong>
          <small>RMM</small>
        </span>
      </a>

      <nav className="site-nav" aria-label={dictionary.header.navigationLabel}>
        {navigationItems.map(([href, key]) => (
          <a href={href} key={href}>
        inert={!menuOpen}
            {dictionary.header[key]}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <a
          className="language-switch"
          href={languageHref}
          aria-label={dictionary.header.languageLabel}
        >
          <Globe2 aria-hidden="true" size={15} />
          {dictionary.header.languageShort}
        </a>
        <a className="header-action" href={actionHref} {...actionProps}>
          {actionLabel} <ArrowRight aria-hidden="true" size={16} />
        </a>
        <button
          type="button"
          className="mobile-menu-toggle"
          aria-label={
            menuOpen ? dictionary.accessibility.closeMenu : dictionary.accessibility.openMenu
          }
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
        </button>
      </div>

      <div
        className={`mobile-nav-backdrop ${menuOpen ? 'open' : ''}`}
        onClick={closeMenu}
        aria-hidden="true"
      />
      <nav
        id="mobile-navigation"
        className={`mobile-navigation ${menuOpen ? 'open' : ''}`}
        aria-label={dictionary.header.navigationLabel}
        aria-hidden={!menuOpen}
      >
        {navigationItems.map(([href, key]) => (
          <a href={href} key={href} onClick={closeMenu} tabIndex={menuOpen ? undefined : -1}>
            {dictionary.header[key]}
          </a>
        ))}
        <a
          className="mobile-navigation-action"
          href={actionHref}
          onClick={closeMenu}
          tabIndex={menuOpen ? undefined : -1}
          {...actionProps}
        >
          {actionLabel} <ArrowRight aria-hidden="true" size={16} />
        </a>
      </nav>
    </header>
  );
}
