/**
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';
import { createTestI18n } from '../../i18n/testI18n';
import type { RegistrationAvailability } from '../../features/gateway/registration';

const testI18n = createTestI18n('zh-CN');

afterEach(() => {
  cleanup();
});

// Mock matchMedia for antd in jsdom
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

// Mock Gateway
vi.mock('../../features/gateway/GatewayProvider', () => ({
  useGateway: () => ({
    authenticated: false,
    initializing: false,
    login: vi.fn(),
  }),
  GatewayLoginError: class extends Error {
    constructor(readonly status: string, message: string) {
      super(message);
    }
  },
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <I18nextProvider i18n={testI18n}>{ui}</I18nextProvider>
    </MemoryRouter>,
  );
}

describe('LoginForm', () => {
  it('calls onSwitchToRegister when the register button is clicked', () => {
    const handleSwitchToRegister = vi.fn();

    renderWithProviders(
      <LoginForm
        registrationAllowed={true}
        onSwitchToRegister={handleSwitchToRegister}
      />,
    );

    const registerBtn = screen.getByRole('button', { name: /注册新账号/ });
    expect(registerBtn).toBeDefined();

    fireEvent.click(registerBtn);
    expect(handleSwitchToRegister).toHaveBeenCalledTimes(1);
  });

  it('does not display the register button when registration is not allowed', () => {
    renderWithProviders(
      <LoginForm registrationAllowed={false} />,
    );

    expect(screen.queryByRole('button', { name: /注册新账号/ })).toBeNull();
  });
});

describe('RegisterForm', () => {
  it('calls onSwitchToLogin when back to login button is clicked', () => {
    const handleSwitchToLogin = vi.fn();
    const handleRegisterSuccess = vi.fn();

    const mockAvailability: RegistrationAvailability = {
      allowed: true,
      isFirstUser: false,
    };

    renderWithProviders(
      <RegisterForm
        availability={mockAvailability}
        onSwitchToLogin={handleSwitchToLogin}
        onRegisterSuccess={handleRegisterSuccess}
      />,
    );

    const backBtn = screen.getByRole('button', { name: /返回登录/ });
    expect(backBtn).toBeDefined();

    fireEvent.click(backBtn);
    expect(handleSwitchToLogin).toHaveBeenCalledTimes(1);
  });
});
