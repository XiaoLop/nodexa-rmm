import { ClockCircleFilled } from '@ant-design/icons';
import type { Device, MeshCentralEvent } from '@meshcentral/control-client';
import { getEventTargetName } from '@meshcentral/shared-state';
import { Empty, Tag } from 'antd';
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
  return (
    <section className="user-detail-log-card">
      <h2><ClockCircleFilled /> {t('userDetails.events.title')}</h2>
      {events.length ? (
        <div className="user-detail-log-table">
          <div className="user-detail-log-head"><span>{t('userDetails.events.time')}</span><span>{t('userDetails.events.type')}</span><span>{t('userDetails.events.content')}</span><span>{t('userDetails.events.resource')}</span><span>{t('userDetails.events.ip')}</span></div>
          {events.map((event) => (
            <div className="user-detail-log-row" key={event.id}>
              <span>{event.occurredAt ? dateTime(event.occurredAt, { second: undefined }) : t('userDetails.missing')}</span>
              <span><Tag>{t(eventTypeKeys[event.type])}</Tag></span>
              <span>{eventMessage(event, t, { devices })}</span>
              <span>{getEventTargetName(event, devices) || event.deviceId || '—'}</span>
              <span>{event.ip || '—'}</span>
            </div>
          ))}
        </div>
      ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('userDetails.events.empty')} />}
    </section>
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
