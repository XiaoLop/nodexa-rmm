import type { RmmPreview, RmmResource, RmmScript } from '@meshcentral/control-client';
import { useRmmQuery } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Typography,
  Tag,
} from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMeshCentralControlData } from '../gateway';
import './rmm-modals.css';

type Values = Record<string, string | number | boolean>;
const listScripts = (api: RmmResource) => api.listScripts();

export function ExecuteScriptModal({
  initial,
  selected,
  onClose,
}: {
  initial?: RmmScript;
  selected?: string[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { client, status, devices, groups } = useMeshCentralControlData();
  const scripts = useRmmQuery(client, status === 'connected' && !initial, listScripts);
  const [script, setScript] = useState(initial);
  const [nodeIds, setNodeIds] = useState(selected ?? []);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [form] = Form.useForm<Values>();
  const [confirmation, setConfirmation] = useState<{
    preview: RmmPreview;
    values: Values;
    key: string;
  }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [submissionUncertain, setSubmissionUncertain] = useState(false);
  return (
    <Modal
      open
      className="rmm-modal rmm-execute-modal"
      width={760}
      centered
      title={t('rmm.execute')}
      onCancel={() => {
        if (!busy) onClose();
      }}
      closable={!busy}
      maskClosable={!busy}
      keyboard={!busy}
      confirmLoading={busy}
      okButtonProps={{ disabled: !script || !client || status !== 'connected' }}
      okText={t(confirmation ? 'rmm.confirm' : 'rmm.preview')}
      onOk={async () => {
        if (!client || !script || busy) return;
        setBusy(true);
        setError(undefined);
        try {
          if (confirmation) {
            const task = await client.rmm.submit(
              confirmation.preview.id,
              confirmation.key,
              confirmation.values,
            );
            onClose();
            navigate('/devices/tasks?tab=rmm&task=' + encodeURIComponent(task.id));
          } else {
            const values = await form.validateFields();
            const preview = await client.rmm.preview(script, nodeIds, groupIds);
            setConfirmation({ preview, values, key: crypto.randomUUID() });
          }
        } catch (error) {
          if (confirmation) setSubmissionUncertain(true);
          if (error instanceof Error) {
            setError(error.message);
            if (error.message === 'PREVIEW_EXPIRED') {
              setConfirmation(undefined);
              setSubmissionUncertain(false);
            }
          } else if (confirmation) {
            setError('REQUEST_FAILED');
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <Space direction="vertical" size={20} style={{ display: 'flex' }}>
        <div className="rmm-step-banner">
          <span className="rmm-step-number" aria-hidden="true">
            {confirmation ? '02' : '01'}
          </span>
          <Typography.Text strong>
            {t(confirmation ? 'rmm.previewStep' : 'rmm.configureStep')}
          </Typography.Text>
        </div>
        {(error || scripts.error) && (
          <Alert type="error" message={t('rmm.error', { code: error ?? scripts.error })} />
        )}
        {!initial && (
          <Select
            placeholder={t('rmm.library')}
            value={script?.id}
            disabled={Boolean(confirmation) || busy}
            options={scripts.result
              ?.filter((entry) => !entry.archived)
              .map((entry) => ({ value: entry.id, label: entry.name + ' v' + entry.version }))}
            onChange={(id) => {
              form.resetFields();
              setScript(scripts.result?.find((entry) => entry.id === id));
            }}
          />
        )}
        {script && (
          <div className="rmm-script-summary">
            <div className="rmm-script-summary-heading">
              <Typography.Text strong>{script.name}</Typography.Text>
              <Tag>v{script.version}</Tag>
            </div>
            <Tag>{script.platform === 'linux' ? 'Linux · /bin/sh' : 'Windows · PowerShell'}</Tag>
            <Typography.Text type="secondary">
              {t(script.platform === 'linux' ? 'rmm.linuxIdentity' : 'rmm.identity')}
            </Typography.Text>
          </div>
        )}
        <div className="rmm-target-fields">
          <label className="rmm-field-label" htmlFor="rmm-target-devices">
            {t('rmm.devices')}
          </label>
          <Select
            id="rmm-target-devices"
            mode="multiple"
            placeholder={t('rmm.devices')}
            value={nodeIds}
            onChange={setNodeIds}
            disabled={Boolean(selected || confirmation) || busy}
            optionFilterProp="label"
            options={devices.map(({ id, name }) => ({ value: id, label: name }))}
          />
          {!selected && (
            <>
              <label className="rmm-field-label" htmlFor="rmm-target-groups">
                {t('rmm.groups')}
              </label>
              <Select
                id="rmm-target-groups"
                mode="multiple"
                placeholder={t('rmm.groups')}
                value={groupIds}
                onChange={setGroupIds}
                disabled={Boolean(confirmation) || busy}
                optionFilterProp="label"
                options={groups.map(({ id, name }) => ({ value: id, label: name }))}
              />
            </>
          )}
        </div>
        <Form
          form={form}
          layout="vertical"
          disabled={Boolean(confirmation) || busy}
          preserve={false}
        >
          {script?.parameters.map(({ name, type, options }) => (
            <Form.Item
              key={name}
              name={name}
              label={name}
              valuePropName={type === 'boolean' ? 'checked' : 'value'}
              initialValue={type === 'boolean' ? false : type === 'string' ? '' : undefined}
              rules={[{ required: type === 'integer' || type === 'enum' }]}
            >
              {type === 'boolean' ? (
                <Switch />
              ) : type === 'integer' ? (
                <InputNumber precision={0} min={-2147483648} max={2147483647} />
              ) : type === 'enum' ? (
                <Select options={options?.map((value) => ({ value, label: value }))} />
              ) : (
                <Input maxLength={1024} />
              )}
            </Form.Item>
          ))}
        </Form>
        {confirmation && (
          <>
            <Alert type="info" message={t('rmm.previewMayChange')} />
            {submissionUncertain && <Alert type="warning" message={t('rmm.submissionUncertain')} />}
            {script && (
              <Descriptions size="small" bordered column={1}>
                <Descriptions.Item label={t('rmm.name')}>
                  {script.name} v{script.version}
                </Descriptions.Item>
                <Descriptions.Item label={t('rmm.platform')}>
                  {script.platform === 'linux' ? 'Linux · /bin/sh' : 'Windows · PowerShell'}
                </Descriptions.Item>
                {script.parameters.map((parameter) => (
                  <Descriptions.Item key={parameter.name} label={parameter.name}>
                    {String(confirmation.values[parameter.name] ?? '')}
                  </Descriptions.Item>
                ))}
              </Descriptions>
            )}
            <Typography.Text strong>
              {t('rmm.targetCount', { count: confirmation.preview.targets.length })}
            </Typography.Text>
            <Space wrap>
              <Typography.Text>
                {t('rmm.eligibleTargets', {
                  count: confirmation.preview.targets.filter((target) => !target.reason).length,
                })}
              </Typography.Text>
              {Object.entries(
                confirmation.preview.targets.reduce<Record<string, number>>((counts, target) => {
                  if (target.reason) counts[target.reason] = (counts[target.reason] ?? 0) + 1;
                  return counts;
                }, {}),
              ).map(([reason, count]) => (
                <Typography.Text key={reason}>
                  {t('rmm.reason.' + reason)}: {count}
                </Typography.Text>
              ))}
            </Space>
            <ul className="rmm-target-preview">
              {confirmation.preview.targets.map((target) => (
                <li key={target.id}>
                  <span>{target.name}</span>
                  <Tag color={target.reason ? 'default' : 'green'}>
                    {target.reason ? t('rmm.reason.' + target.reason) : t('rmm.readyTarget')}
                  </Tag>
                </li>
              ))}
            </ul>
            <Button
              disabled={busy || submissionUncertain}
              onClick={() => {
                setConfirmation(undefined);
                setError(undefined);
              }}
            >
              {t('rmm.editTargets')}
            </Button>
          </>
        )}
      </Space>
    </Modal>
  );
}
