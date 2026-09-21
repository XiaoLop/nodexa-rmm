// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestI18n } from '../i18n/testI18n';
import { LoginPage } from './LoginPage';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

vi.mock('../features/gateway/GatewayProvider', () => ({
  useGateway: () => ({
    initializing: false,
    authenticated: false,
    configured: true,
    login: vi.fn(),
  }),
}));

describe('LoginPage i18n rendering', () => {
  it('renders correctly in zh-CN', () => {
    const testI18n = createTestI18n('zh-CN');

    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(screen.getByRole('heading', { name: '系统登录' })).toBeDefined();
    expect(screen.getByText('安全 · 高效 · 可控')).toBeDefined();
    expect(screen.getByPlaceholderText('请输入用户名或邮箱')).toBeDefined();
    expect(screen.getByPlaceholderText('请输入密码')).toBeDefined();
  });

  it('renders correctly in en-US', () => {
    const testI18n = createTestI18n('en-US');

    render(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <LoginPage />
        </MemoryRouter>
      </I18nextProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined();
    expect(screen.getByText('Secure · Efficient · Controlled')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter your username or email')).toBeDefined();
    expect(screen.getByPlaceholderText('Enter your password')).toBeDefined();
  });
});
