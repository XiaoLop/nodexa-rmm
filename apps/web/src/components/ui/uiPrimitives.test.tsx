/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FilterBar, PageHeader, Panel, StatusBadge } from '.';

afterEach(cleanup);

describe('UI primitives', () => {
  it('renders a page header with accessible heading and actions', () => {
    render(
      <PageHeader
        title="Devices"
        description="Manage endpoints"
        status={<StatusBadge tone="success">Connected</StatusBadge>}
        actions={<button type="button">Add device</button>}
      />,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Devices' })).toBeDefined();
    expect(screen.getByText('Manage endpoints')).toBeDefined();
    expect(screen.getByText('Connected')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add device' })).toBeDefined();
  });

  it('renders panel and filter bar semantics without hiding content', () => {
    render(
      <Panel title="Inventory" description="All managed devices">
        <FilterBar aria-label="Device filters">
          <input aria-label="Search" />
        </FilterBar>
      </Panel>,
    );

    expect(screen.getByRole('heading', { level: 2, name: 'Inventory' })).toBeDefined();
    expect(screen.getByLabelText('Device filters')).toBeDefined();
    expect(screen.getByLabelText('Search')).toBeDefined();
  });
});