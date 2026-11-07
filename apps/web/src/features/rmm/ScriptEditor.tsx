import type {
  MeshCentralClient,
  RmmParameter,
  RmmScript,
  RmmScriptDraft,
} from '@meshcentral/control-client';
import { Alert, Button, Form, Input, Modal, Select, Space } from 'antd';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useServerFiles } from '../server-files/useServerFiles';

export const maxScriptBytes = 64 * 1024;

export function decodeScript(name: string, bytes: ArrayBuffer | Uint8Array): string {
  if (!/\.ps1$/i.test(name) || bytes.byteLength > maxScriptBytes) throw new Error('INVALID_SCRIPT');
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

type EditorProps = {
  client: MeshCentralClient;
  current?: RmmScript;
  imported?: Pick<RmmScriptDraft, 'name' | 'body'>;
  canBrowse?: boolean;
  onClose: () => void;
  onSaved: () => void;
};

export function ScriptEditor({
  client,
  current,
  imported,
  canBrowse,
  onClose,
  onSaved,
}: EditorProps) {
  const { t } = useTranslation();
  const [form] = Form.useForm<RmmScriptDraft>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [browse, setBrowse] = useState(false);
  const files = useServerFiles({ client: browse ? client : undefined, connected: browse });
  const importBody = async (name: string, read: () => Promise<ArrayBuffer | Uint8Array>) => {
    setBusy(true);
    setError(undefined);
    try {
      const body = decodeScript(name, await read());
      form.setFieldsValue({ body, name: form.getFieldValue('name') || name.slice(0, -4) });
      setBrowse(false);
    } catch {
      setError('INVALID_SCRIPT');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      title={t('rmm.editor')}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText={t('rmm.saveVersion')}
      confirmLoading={busy}
      width={850}
    >
      {error && <Alert type="error" message={t('rmm.error', { code: error })} />}
      <Form
        form={form}
        layout="vertical"
        initialValues={current ?? { ...imported, description: '', parameters: [] }}
        onFinish={async (draft) => {
          setBusy(true);
          setError(undefined);
          try {
            await client.rmm.saveScript(draft, current);
            onSaved();
          } catch (error) {
            setError(error instanceof Error ? error.message : 'REQUEST_FAILED');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Space wrap>
          <label>
            {t('rmm.localImport')}{' '}
            <input
              type="file"
              accept=".ps1"
              disabled={busy}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                event.currentTarget.value = '';
                if (!file) return;
                if (file.size > maxScriptBytes) setError('INVALID_SCRIPT');
                else void importBody(file.name, () => file.arrayBuffer());
              }}
            />
          </label>
          {canBrowse && <Button onClick={() => setBrowse(!browse)}>{t('rmm.serverImport')}</Button>}
        </Space>
        {browse && (
          <Space direction="vertical" style={{ display: 'flex' }}>
            {files.error && <Alert type="error" message={files.error} />}
            <Select
              loading={files.loading}
              value={files.currentSpace?.id}
              options={files.tree?.spaces.map(({ id, name }) => ({ value: id, label: name }))}
              onChange={files.openSpace}
              style={{ minWidth: 220 }}
            />
            {files.currentPath.length > 1 && (
              <Button onClick={() => files.openPath(files.currentPath.slice(0, -1))}>..</Button>
            )}
            {files.entries
              .filter((entry) => entry.kind === 'directory' || /\.ps1$/i.test(entry.name))
              .map((entry) => (
                <Button
                  key={entry.name}
                  disabled={busy || (entry.size ?? 0) > maxScriptBytes}
                  onClick={() => {
                    if (entry.kind === 'directory') files.openDirectory(entry);
                    else void importBody(entry.name, () => files.readFile(entry));
                  }}
                >
                  {entry.name}
                </Button>
              ))}
          </Space>
        )}
        <Form.Item label={t('rmm.name')} name="name" rules={[{ required: true, max: 100 }]}>
          <Input />
        </Form.Item>
        <Form.Item label={t('rmm.description')} name="description">
          <Input maxLength={1000} />
        </Form.Item>
        <Form.Item label="PowerShell" name="body" rules={[{ required: true }]}>
          <Input.TextArea rows={10} />
        </Form.Item>
        <Form.List name="parameters">
          {(fields, { add, remove }) => (
            <Space direction="vertical" style={{ display: 'flex' }}>
              {fields.map(({ key, name }) => (
                <Space key={key} wrap align="start">
                  <Form.Item
                    name={[name, 'name']}
                    rules={[{ required: true, pattern: /^[a-z][a-z0-9_]{0,39}$/i }]}
                  >
                    <Input placeholder={t('rmm.parameter')} />
                  </Form.Item>
                  <Form.Item name={[name, 'type']} rules={[{ required: true }]}>
                    <Select<RmmParameter['type']>
                      style={{ width: 130 }}
                      options={(['string', 'integer', 'boolean', 'enum'] as const).map((value) => ({
                        value,
                        label: t('rmm.' + value),
                      }))}
                    />
                  </Form.Item>
                  <Form.Item noStyle shouldUpdate>
                    {({ getFieldValue }) =>
                      getFieldValue(['parameters', name, 'type']) === 'enum' && (
                        <Form.Item name={[name, 'options']} rules={[{ required: true }]}>
                          <Select
                            mode="tags"
                            placeholder={t('rmm.enumOptions')}
                            style={{ minWidth: 220 }}
                          />
                        </Form.Item>
                      )
                    }
                  </Form.Item>
                  <Button onClick={() => remove(name)}>{t('rmm.remove')}</Button>
                </Space>
              ))}
              <Button disabled={fields.length >= 20} onClick={() => add({ type: 'string' })}>
                {t('rmm.addParameter')}
              </Button>
            </Space>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
