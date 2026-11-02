import { ConsoleTable, Panel } from '../ui';
import { ClockCircleFilled } from '@ant-design/icons';
import type { Device, MeshCentralEvent } from '@meshcentral/control-client';
import { getEventTargetName } from '@meshcentral/shared-state';
import { Empty, Tag, type TableColumnsType } from 'antd';
import { useTranslation } from 'react-i18next';
import { eventMessage } from '../../features/events/eventPresentation';
import { useFormatters } from '../../i18n/formatters';

const eventTypeKeys: Record<MeshCentralEvent['type'], string> = {
  deviceOnline: 'userDetails.events.types.deviceOnline',
  deviceOffline: 'userDetails.events.types.deviceOffline',
  deviceChanged: 'userDetails.events.types.deviceChanged',
  deviceRemoved: 'userDetails.events.types.deviceRemoved',
  relayLog: 'userDetails.events.types.relayLog',
  agentLog: 'userDetails.events.types.agentLog',
  manualOperation: 'userDetails.events.types.manualOperation',
  commandExecution: 'userDetails.events.types.commandExecution',
  batchUpload: 'userDetails.events.types.batchUpload',
  userSessionCount: 'userDetails.events.types.userSessionCount',
  unknown: 'userDetails.events.types.unknown',
};

interface EventTableProps {
  events: MeshCentralEvent[];
  devices: Device[];
}

/** Event log table used by both the overview (last 10) and the logs tab. */
export function EventTable({ events, devices }: EventTableProps) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const columns: TableColumnsType<MeshCentralEvent> = [
    {
      title: t('userDetails.events.time'),
      key: 'time',
      width: 170,
      render: (_, event) =>
        event.occurredAt
          ? dateTime(event.occurredAt, { second: undefined })
          : t('userDetails.missing'),
    },
    {
      title: t('userDetails.events.type'),
      key: 'type',
      width: 150,
      render: (_, event) => <Tag>{t(eventTypeKeys[event.type])}</Tag>,
    },
    {
      title: t('userDetails.events.content'),
      key: 'content',
      ellipsis: true,
      render: (_, event) => eventMessage(event, t, { devices }),
    },
    {
      title: t('userDetails.events.resource'),
      key: 'resource',
      width: 180,
      ellipsis: true,
      render: (_, event) => getEventTargetName(event, devices) || event.deviceId || '—',
    },
    {
      title: t('userDetails.events.ip'),
      dataIndex: 'ip',
      key: 'ip',
      width: 140,
      render: (value?: string) => value || '—',
    },
  ];
  return (
    <Panel
      className="user-detail-data-panel"
      title={
        <>
          <ClockCircleFilled /> {t('userDetails.events.title')}
        </>
      }
    >
      <ConsoleTable<MeshCentralEvent>
        rowKey="id"
        columns={columns}
        dataSource={events}
        scroll={{ x: 900 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('userDetails.events.empty')}
            />
          ),
        }}
      />
    </Panel>
  );
}

interface UserDetailsLogsTabProps {
  events: MeshCentralEvent[];
  devices: Device[];
}

/** Logs tab: the full event history for the user. */
export function UserDetailsLogsTab({ events, devices }: UserDetailsLogsTabProps) {
  return <EventTable events={events} devices={devices} />;
}
