import { CopyOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons';
import {
  Alert,
  Button,
  Descriptions,
  Drawer,
  Empty,
  Input,
  Modal,
  Select,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerTrace } from '../../features/server-admin/hooks';
import { downloadText, printable, traceSourceOptions } from '../../features/server-admin/model';

type TraceRecord = ReturnType<typeof useServerTrace>['records'][number];
type TraceWindow = '15m' | '1h' | 'all';

function sanitizedTraceValue(value: unknown, key = ''): unknown {
  if (
    /(?:password|passwd|token|secret|cookie|authorization|credential|private.?key|session.?id)/i.test(
      key,
    )
  ) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) return value.map((item) => sanitizedTraceValue(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        sanitizedTraceValue(childValue, childKey),
      ]),
    );
  }
  if (typeof value !== 'string') return value;
  return value
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[REDACTED]')
    .replace(/\b((?:access|refresh|auth|api)[_-]?token\s*[:=]\s*)[^\s,;"']+/gi, '$1[REDACTED]')
    .replace(/\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[REDACTED JWT]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[REDACTED ID]');
}

export function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const parts = [];
  let start = 0;
  let index = text.toLocaleLowerCase().indexOf(keyword.toLocaleLowerCase());
  while (index !== -1) {
    parts.push(
      text.slice(start, index),
      <mark key={index}>{text.slice(index, index + keyword.length)}</mark>,
    );
    start = index + keyword.length;
    index = text.toLocaleLowerCase().indexOf(keyword.toLocaleLowerCase(), start);
  }
  parts.push(text.slice(start));
  return <>{parts}</>;
}

export function TracePanel() {
  const { t } = useTranslation();
  const trace = useServerTrace();
  const [draft, setDraft] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [timeWindow, setTimeWindow] = useState<TraceWindow>('15m');
  const [newSincePause, setNewSincePause] = useState(0);
  const previousCount = useRef(trace.records.length);
  const previousPauseState = useRef(trace.paused);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'failed' | 'sent' | undefined>();
  const [selected, setSelected] = useState<{ record: TraceRecord; index: number }>();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditing(false);
    setDraft([]);
    setConfirm(false);
    setNotice(undefined);
    setNewSincePause(0);
    previousCount.current = trace.records.length;
    previousPauseState.current = trace.paused;
  }, [trace.client, trace.connected, trace.generation]);

  useEffect(() => {
    if (trace.paused && !previousPauseState.current) setNewSincePause(0);
    const delta = Math.max(0, trace.records.length - previousCount.current);
    if (delta && trace.paused) setNewSincePause((count) => count + delta);
    previousCount.current = trace.records.length;
    previousPauseState.current = trace.paused;
  }, [trace.records.length, trace.paused]);

  const sourceOptions = useMemo(
    () =>
      traceSourceOptions(
        trace.sources,
        trace.records.map((record) => record.source),
      ),
    [trace.sources, trace.records],
  );
  const visible = useMemo(() => {
    const timeLimit =
      timeWindow === 'all' ? 0 : Date.now() - (timeWindow === '15m' ? 15 : 60) * 60_000;
    const query = keyword.trim().toLocaleLowerCase();
    return trace.records
      .map((record, index) => ({ record, index }))
      .filter(({ record }) => {
        const text = record.args.map(printable).join(' ');
        return (
          (!categories.length || categories.includes(record.source)) &&
          (!timeLimit || record.time >= timeLimit) &&
          (!query || `${record.source} ${text}`.toLocaleLowerCase().includes(query))
        );
      });
  }, [trace.records, categories, keyword, timeWindow]);

  useEffect(() => {
    if (!trace.paused) bottom.current?.scrollIntoView?.({ block: 'nearest' });
  }, [visible, trace.paused]);

  const apply = async () => {
    if (!trace.client || trace.client.connectionStatus !== 'connected' || busy) return;
    setBusy(true);
    setNotice(undefined);
    try {
      await trace.client.server.setTraceSources(draft);
      setNotice('sent');
      setEditing(false);
    } catch {
      setNotice('failed');
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  };

  const copySelected = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(sanitizedTraceValue(selected.record), null, 2),
      );
      void message.success(t('serverAdmin.copiedRedacted'));
    } catch {
      void message.error(t('serverAdmin.copyFailed'));
    }
  };

  return (
    <div className="server-trace-container">
      {!trace.connected && <Alert type="warning" title={t('serverAdmin.disconnected')} />}
      {notice && (
        <Alert type={notice === 'failed' ? 'error' : 'info'} title={t(`serverAdmin.${notice}`)} />
      )}

      <div className="server-trace-overview" aria-label={t('serverAdmin.traceOverview')}>
        <div className="server-trace-overview-status">
          <span className={`server-trace-live-dot ${trace.connected ? 'is-connected' : ''}`} />
          <span>{t(trace.connected ? 'serverAdmin.live' : 'serverAdmin.disconnected')}</span>
        </div>
        <div className="server-trace-overview-stat">
          <span>{t('serverAdmin.totalEvents')}</span>
          <strong>{trace.records.length.toLocaleString()}</strong>
        </div>
      </div>

      <div className="server-trace-global-row">
        <Select
          mode="multiple"
          aria-label={t('serverAdmin.globalCategories')}
          className="server-trace-global-select"
          placeholder={t('serverAdmin.globalCategories')}
          options={sourceOptions}
          value={editing ? draft : [...(trace.sources ?? [])]}
          disabled={!trace.connected || busy}
          onChange={(values) => {
            setDraft(values);
            setEditing(true);
          }}
        />
        <Button
          type="primary"
          disabled={!trace.connected || !editing || busy}
          onClick={() => setConfirm(true)}
        >
          {t('serverAdmin.apply')}
        </Button>
      </div>

      <Modal
        title={t('serverAdmin.apply')}
        open={confirm}
        onCancel={() => setConfirm(false)}
        onOk={() => void apply()}
        confirmLoading={busy}
        okButtonProps={{ disabled: !trace.connected }}
      >
        {t('serverAdmin.globalWarning')}
        <pre>{draft.join(', ') || t('serverAdmin.none')}</pre>
      </Modal>

      <div className="server-ops-toolbar server-trace-toolbar">
        <div className="server-ops-toolbar-left">
          <Input
            aria-label={t('serverAdmin.keyword')}
            placeholder={t('serverAdmin.eventSearch')}
            value={keyword}
            prefix={<SearchOutlined />}
            onChange={(event) => setKeyword(event.target.value)}
            allowClear
          />
          <Select
            mode="multiple"
            maxTagCount={2}
            maxTagPlaceholder={(omittedValues) => `+${omittedValues.length}`}
            className="server-trace-category-filter"
            aria-label={t('serverAdmin.localCategories')}
            placeholder={t('serverAdmin.localCategories')}
            options={sourceOptions}
            value={categories}
            onChange={setCategories}
            suffixIcon={<FilterOutlined />}
          />
          <Select
            aria-label={t('serverAdmin.timeFilter')}
            value={timeWindow}
            onChange={setTimeWindow}
            options={[
              { value: '15m', label: t('serverAdmin.last15Minutes') },
              { value: '1h', label: t('serverAdmin.lastHour') },
              { value: 'all', label: t('serverAdmin.allRetained') },
            ]}
          />
        </div>
        <div className="server-ops-toolbar-right">
          <label className="server-trace-switch-label">
            <Switch
              checked={!trace.paused}
              onChange={(enabled) => {
                trace.setPaused(!enabled);
                if (enabled) {
                  setNewSincePause(0);
                  bottom.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
                }
              }}
              aria-label={t('serverAdmin.liveStream')}
            />
            <span>{t('serverAdmin.liveStream')}</span>
          </label>
          <Button
            onClick={() =>
              downloadText(
                JSON.stringify(
                  visible.map(({ record }) => sanitizedTraceValue(record)),
                  null,
                  2,
                ),
                'server-trace.json',
                'application/json',
              )
            }
          >
            {t('serverAdmin.export')}
          </Button>
          <Button onClick={trace.clearRecords}>{t('serverAdmin.clearLocal')}</Button>
          <Typography.Text type="secondary">
            {t('serverAdmin.recordLimit', { count: trace.records.length })}
          </Typography.Text>
        </div>
      </div>

      {trace.paused && newSincePause > 0 && (
        <div className="server-trace-new-events">
          <span>{t('serverAdmin.newEvents', { count: newSincePause })}</span>
          <Button
            size="small"
            type="link"
            onClick={() => {
              setNewSincePause(0);
              trace.setPaused(false);
              bottom.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
            }}
          >
            {t('serverAdmin.jumpToLatest')}
          </Button>
        </div>
      )}

      <div className="server-ops-viewport server-trace-viewport">
        <div className="trace-viewport-header">
          <span>{t('serverAdmin.time')}</span>
          <span>{t('serverAdmin.source')}</span>
          <span>{t('serverAdmin.content')}</span>
        </div>
        <div
          role="log"
          aria-live="off"
          aria-label={t('serverAdmin.traceRecords')}
          className="server-ops-viewport-scrollable"
        >
          {visible.length ? (
            visible.map(({ record, index }) => {
              const text = record.args.map(printable).join(' ');
              return (
                <button
                  type="button"
                  key={`${record.time}-${index}`}
                  className="trace-log-line server-trace-row"
                  onClick={() => setSelected({ record, index })}
                >
                  <span className="trace-timestamp">
                    {new Date(record.time).toLocaleTimeString()}
                  </span>
                  <span className="trace-tag" data-source={record.source}>
                    {record.source}
                  </span>
                  <span className="trace-content">
                    <Highlight keyword={keyword} text={String(sanitizedTraceValue(text))} />
                  </span>
                </button>
              );
            })
          ) : (
            <div className="server-ops-empty-box">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('serverAdmin.noTraceRecords')}
              />
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>

      <Drawer
        title={t('serverAdmin.eventDetails')}
        placement="right"
        size={560}
        open={Boolean(selected)}
        onClose={() => setSelected(undefined)}
      >
        {selected && (
          <div className="server-trace-details">
            <Descriptions size="small" column={1} bordered>
              <Descriptions.Item label={t('serverAdmin.time')}>
                {new Date(selected.record.time).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label={t('serverAdmin.source')}>
                <Tag>{selected.record.source}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('serverAdmin.recordIndex')}>
                #{selected.index + 1}
              </Descriptions.Item>
            </Descriptions>
            <div className="server-trace-details-heading">
              <Typography.Text strong>{t('serverAdmin.sanitizedPayload')}</Typography.Text>
              <Button icon={<CopyOutlined />} onClick={() => void copySelected()}>
                {t('common.actions.copy')}
              </Button>
            </div>
            <pre className="server-trace-json">
              {JSON.stringify(sanitizedTraceValue(selected.record), null, 2)}
            </pre>
            <Typography.Text type="secondary">{t('serverAdmin.redactionNotice')}</Typography.Text>
          </div>
        )}
      </Drawer>
    </div>
  );
}
