import { Alert, Button, Input, Modal, Select, Space, Switch, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerTrace } from '../../features/server-admin/hooks';
import { downloadText, printable, traceSourceOptions } from '../../features/server-admin/model';

export function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return <>{text}</>;
  const parts = [];
  let start = 0;
  let index = text.toLocaleLowerCase().indexOf(keyword.toLocaleLowerCase());
  while (index !== -1) {
    parts.push(text.slice(start, index), <mark key={index}>{text.slice(index, index + keyword.length)}</mark>);
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
  const [autoScroll, setAutoScroll] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'failed' | 'sent' | undefined>();
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setEditing(false);
    setDraft([]);
    setConfirm(false);
    setNotice(undefined);
  }, [trace.client, trace.connected, trace.generation]);
  const visible = useMemo(() => trace.records.filter(record =>
    (!categories.length || categories.includes(record.source))), [trace.records, categories]);
  const options = useMemo(() => traceSourceOptions(trace.sources, trace.records.map(record => record.source)), [trace.sources, trace.records]);
  useEffect(() => {
    if (autoScroll && !trace.paused) bottom.current?.scrollIntoView?.({ block: 'nearest' });
  }, [visible, autoScroll, trace.paused]);
  const apply = async () => {
    if (!trace.client || trace.client.connectionStatus !== 'connected' || busy) return;
    setBusy(true);
    setNotice(undefined);
    try { await trace.client.server.setTraceSources(draft); setNotice('sent'); setEditing(false); }
    catch { setNotice('failed'); }
    finally { setBusy(false); setConfirm(false); }
  };
  return <Space orientation="vertical" style={{ width: '100%' }}>
    <Alert type="warning" showIcon title={t('serverAdmin.globalWarning')} />
    {!trace.connected && <Alert type="warning" title={t('serverAdmin.disconnected')} />}
    {notice && <Alert type={notice === 'failed' ? 'error' : 'info'} title={t(`serverAdmin.${notice}`)} />}
    <Typography.Text>{t('serverAdmin.enabled')}: {trace.sources === undefined ? t('serverAdmin.unknown') : trace.sources.length ? trace.sources.join(', ') : t('serverAdmin.none')}</Typography.Text>
    <Select mode="multiple" aria-label={t('serverAdmin.globalCategories')} style={{ width: '100%' }} options={options}
      value={editing ? draft : [...(trace.sources ?? [])]} disabled={!trace.connected || busy}
      onChange={values => { setDraft(values); setEditing(true); }} />
    <Button disabled={!trace.connected || !editing || busy} onClick={() => setConfirm(true)}>{t('serverAdmin.apply')}</Button>
    <Modal title={t('serverAdmin.apply')} open={confirm} onCancel={() => setConfirm(false)}
      onOk={() => void apply()} confirmLoading={busy} okButtonProps={{ disabled: !trace.connected }}>
      {t('serverAdmin.globalWarning')}<pre>{draft.join(', ') || t('serverAdmin.none')}</pre>
    </Modal>
    <Select mode="multiple" aria-label={t('serverAdmin.localCategories')} placeholder={t('serverAdmin.localCategories')}
      style={{ width: '100%' }} options={options} value={categories} onChange={setCategories} />
    <Input aria-label={t('serverAdmin.keyword')} placeholder={t('serverAdmin.keyword')} value={keyword} onChange={event => setKeyword(event.target.value)} />
    <Space wrap>
      <Switch checked={trace.paused} onChange={trace.setPaused} checkedChildren={t('serverAdmin.paused')} unCheckedChildren={t('serverAdmin.live')} />
      <Switch checked={autoScroll} onChange={setAutoScroll} aria-label={t('serverAdmin.autoScroll')} />{t('serverAdmin.autoScroll')}
      <Button onClick={() => downloadText(JSON.stringify(visible, null, 2), 'server-trace.json', 'application/json')}>{t('serverAdmin.export')}</Button>
      <Button onClick={trace.clearRecords}>{t('serverAdmin.clearLocal')}</Button>
      <Typography.Text>{t('serverAdmin.recordLimit', { count: trace.records.length })}</Typography.Text>
    </Space>
    <div role="log" style={{ height: 440, overflow: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontFamily: 'monospace' }}>
      {visible.map((record, index) => <div key={index}><Highlight keyword={keyword}
        text={`${new Date(record.time).toLocaleTimeString()} [${record.source}] ${record.args.map(printable).join(' ')}`} /></div>)}
      <div ref={bottom} />
    </div>
  </Space>;
}
