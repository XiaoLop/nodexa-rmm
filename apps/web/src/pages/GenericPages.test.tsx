// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';
import { DonutChart, TrendChart } from '../components/ConsoleUi';
import { createTestI18n } from '../i18n/testI18n';
import { ComingSoonPage } from './ComingSoonPage';
import { NotFoundPage } from './NotFoundPage';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: () => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
});

describe('Generic Pages and ConsoleUi i18n', () => {
  describe('NotFoundPage', () => {
    it('renders in zh-CN', () => {
      const i18n = createTestI18n('zh-CN');
      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <NotFoundPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect(screen.getByText('页面不存在')).toBeDefined();
      expect(screen.getByText('返回概览')).toBeDefined();
    });

    it('renders in en-US', () => {
      const i18n = createTestI18n('en-US');
      render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <NotFoundPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect(screen.getByText('Page not found')).toBeDefined();
      expect(screen.getByText('Back to overview')).toBeDefined();
    });
  });

  describe('ComingSoonPage', () => {
    it('renders in zh-CN and en-US', async () => {
      const i18n = createTestI18n('zh-CN');
      const { rerender } = render(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <ComingSoonPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect(screen.getByText('功能正在接入')).toBeDefined();
      expect(screen.getByText('返回仪表盘')).toBeDefined();

      await i18n.changeLanguage('en-US');
      rerender(
        <I18nextProvider i18n={i18n}>
          <MemoryRouter>
            <ComingSoonPage />
          </MemoryRouter>
        </I18nextProvider>,
      );
      expect(screen.getByText('Coming Soon')).toBeDefined();
      expect(screen.getByText('Back to dashboard')).toBeDefined();
    });
  });

  describe('ConsoleUi charts', () => {
    it('renders TrendChart and DonutChart with current locale', () => {
      const i18n = createTestI18n('en-US');
      render(
        <I18nextProvider i18n={i18n}>
          <div>
            <TrendChart online={[1, 2]} offline={[0, 1]} />
            <DonutChart data={[{ label: 'Linux', value: 10, color: '#000' }]} total={10} />
          </div>
        </I18nextProvider>,
      );
      expect(screen.getByText('Online')).toBeDefined();
      expect(screen.getByText('Offline')).toBeDefined();
      expect(screen.getByText('Now')).toBeDefined();
      expect(screen.getByText('Total')).toBeDefined();
    });
  });
});
