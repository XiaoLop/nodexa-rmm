import type { MeshCentralClient, RmmResource, RmmScript } from '@meshcentral/control-client';
import { useRmmQuery } from '@meshcentral/shared-state';
import { Alert, Button, InputNumber, Space, Spin, Typography } from 'antd';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatters } from '../../i18n';

export function ScriptHistory({
  client,
  script,
  connected,
}: {
  client?: MeshCentralClient;
  script: RmmScript;
  connected: boolean;
}) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const [pages, setPages] = useState<number[]>([]);
  const [left, setLeft] = useState<number | null>(Math.max(1, script.version - 1));
  const [right, setRight] = useState<number | null>(script.version);
  const [comparison, setComparison] = useState<[number, number]>();
  const before = pages.at(-1);
  const list = useCallback(
    (api: RmmResource) => api.listScriptVersions(script.id, before),
    [script.id, before],
  );
  const compare = useCallback(
    (api: RmmResource) => {
      if (!comparison) throw new Error('INVALID_INPUT');
      return Promise.all(comparison.map((version) => api.getScriptVersion(script.id, version)));
    },
    [script.id, comparison],
  );
  const history = useRmmQuery(client, connected, list);
  const versions = useRmmQuery(client, connected && !!comparison, compare);
  return (
    <section>
      <Typography.Title level={5}>{t('rmm.versionHistory')}</Typography.Title>
      {history.error && <Alert type="error" message={t('rmm.error', { code: history.error })} />}
      {connected && !history.result && !history.error && <Spin />}
      {history.result?.versions.map((item) => (
        <div key={item.version}>
          v{item.version}
          {item.actor && ` · ${item.actor}`}
          {item.created !== undefined && ` · ${dateTime(new Date(item.created).toISOString())}`}
        </div>
      ))}
      <Space wrap>
        <Button disabled={!pages.length} onClick={() => setPages((value) => value.slice(0, -1))}>
          {t('rmm.previous')}
        </Button>
        <Button
          disabled={history.result?.before === undefined}
          onClick={() => {
            const next = history.result?.before;
            if (next !== undefined) setPages((value) => [...value, next]);
          }}
        >
          {t('rmm.next')}
        </Button>
      </Space>
      <Typography.Title level={5}>{t('rmm.compareVersions')}</Typography.Title>
      <Space wrap>
        <InputNumber
          aria-label={t('rmm.compareFrom')}
          min={1}
          max={script.version}
          precision={0}
          value={left}
          onChange={setLeft}
        />
        <InputNumber
          aria-label={t('rmm.compareTo')}
          min={1}
          max={script.version}
          precision={0}
          value={right}
          onChange={setRight}
        />
        <Button
          disabled={
            !connected ||
            left === null ||
            right === null ||
            !Number.isSafeInteger(left) ||
            !Number.isSafeInteger(right) ||
            left < 1 ||
            right < 1 ||
            left > script.version ||
            right > script.version
          }
          onClick={() => {
            if (left && right) setComparison([left, right]);
          }}
        >
          {t('rmm.compareVersions')}
        </Button>
      </Space>
      {versions.error && <Alert type="error" message={t('rmm.error', { code: versions.error })} />}
      {comparison && connected && !versions.result && !versions.error && <Spin />}
      {versions.result && (
        <Space align="start" wrap>
          {versions.result.map((item, index) => (
            <div key={index}>
              <Typography.Title level={5}>
                v{item.version} · {item.name}
              </Typography.Title>
              <p>
                {item.description || '—'} ·{' '}
                {item.platform === 'linux' ? 'Linux · /bin/sh' : 'Windows · PowerShell'}
              </p>
              <p>
                {t('rmm.tags')}: {(item.tags ?? []).join(', ') || '—'}
              </p>
              <p>
                {t('rmm.parametersTitle')}:{' '}
                {item.parameters
                  .map(
                    (parameter) =>
                      `${parameter.name}: ${parameter.type}${parameter.options ? ` (${parameter.options.join(', ')})` : ''}`,
                  )
                  .join('; ') || '—'}
              </p>
              {item.body === undefined ? (
                <Alert type="info" message={t('rmm.bodyUnavailable')} />
              ) : (
                <div className="task-command-output-box">
                  <pre className="task-command-pre">{item.body}</pre>
                </div>
              )}
            </div>
          ))}
        </Space>
      )}
    </section>
  );
}
