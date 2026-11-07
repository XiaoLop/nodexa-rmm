import type { RmmPreview, RmmResource, RmmScript } from '@meshcentral/control-client';
import { useRmmQuery } from '@meshcentral/shared-state';
import { Alert, Form, Input, InputNumber, Modal, Select, Space, Switch, Typography } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMeshCentralControlData } from '../gateway';

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
  return (
    <Modal
      open
      title={t('rmm.execute')}
      onCancel={onClose}
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
          if (error instanceof Error) {
            setError(error.message);
            if (error.message === 'PREVIEW_EXPIRED') setConfirmation(undefined);
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <Space direction="vertical" style={{ display: 'flex' }}>
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
          <Typography.Text strong>
            {script.name} v{script.version}
          </Typography.Text>
        )}
        <Typography.Text>{t('rmm.identity')}</Typography.Text>
        <Select
          mode="multiple"
          placeholder={t('rmm.devices')}
          value={nodeIds}
          onChange={setNodeIds}
          disabled={Boolean(selected || confirmation) || busy}
          optionFilterProp="label"
          options={devices.map(({ id, name }) => ({ value: id, label: name }))}
        />
        {!selected && (
          <Select
            mode="multiple"
            placeholder={t('rmm.groups')}
            value={groupIds}
            onChange={setGroupIds}
            disabled={Boolean(confirmation) || busy}
            optionFilterProp="label"
            options={groups.map(({ id, name }) => ({ value: id, label: name }))}
          />
        )}
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
            <Typography.Text strong>
              {t('rmm.targetCount', { count: confirmation.preview.targets.length })}
            </Typography.Text>
            <ul style={{ maxHeight: 220, overflow: 'auto' }}>
              {confirmation.preview.targets.map((target) => (
                <li key={target.id}>
                  {target.name}
                  {target.reason ? ' · ' + t('rmm.reason.' + target.reason) : ''}
                </li>
              ))}
            </ul>
          </>
        )}
      </Space>
    </Modal>
  );
}
