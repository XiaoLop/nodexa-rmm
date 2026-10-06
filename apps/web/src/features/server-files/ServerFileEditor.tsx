import { MAX_SERVER_FILE_BYTES, type ServerFileEntry } from '@meshcentral/control-client';
import { CodeOutlined, FileTextOutlined } from '@ant-design/icons';
import { Alert, Input, Modal, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { containsLikelyBinaryData, formatServerFileSize } from './serverFileViewModel';

interface ServerFileEditorProps {
  entry?: ServerFileEntry;
  onRead: (entry: ServerFileEntry) => Promise<Uint8Array>;
  onSave: (entry: ServerFileEntry, data: Uint8Array) => Promise<boolean> | boolean;
  onClose: () => void;
}

export function ServerFileEditor({ entry, onRead, onSave, onClose }: ServerFileEditorProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!entry) return;
    let active = true;
    setLoading(true);
    setError(undefined);
    void onRead(entry)
      .then((data) => {
        if (!active) return;
        if (containsLikelyBinaryData(data)) throw new Error(t('serverFiles.errors.binaryFile'));
        const text = new TextDecoder('utf-8').decode(data);
        setContent(text);
        setInitialContent(text);
      })
      .catch((readError) => {
        if (active) setError(readError instanceof Error ? readError.message : String(readError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entry, onRead, t]);

  const encoded = useMemo(() => new TextEncoder().encode(content), [content]);
  const tooLarge = encoded.byteLength >= MAX_SERVER_FILE_BYTES;
  const dirty = content !== initialContent;
  const lineCount = useMemo(() => content.split('\n').length, [content]);

  const close = () => {
    if (dirty && !window.confirm(t('serverFiles.editor.discardConfirm'))) return;
    onClose();
  };

  const titleNode = entry ? (
    <div className="server-files-editor-header">
      <div className="server-files-editor-title">
        <span className="server-files-editor-icon">
          {entry.name.endsWith('.json') ||
          entry.name.endsWith('.js') ||
          entry.name.endsWith('.ts') ? (
            <CodeOutlined />
          ) : (
            <FileTextOutlined />
          )}
        </span>
        <span className="server-files-editor-name">{entry.name}</span>
      </div>
      <Space size={6} className="server-files-editor-meta">
        <Tag color="blue">{formatServerFileSize(encoded.byteLength)}</Tag>
        {dirty && <Tag color="warning">未保存 / Unsaved</Tag>}
      </Space>
    </div>
  ) : null;

  return (
    <Modal
      open={Boolean(entry)}
      title={titleNode}
      width={860}
      okText={t('common.actions.save')}
      cancelText={t('common.actions.close')}
      okButtonProps={{ disabled: loading || !dirty || tooLarge || Boolean(error), loading: saving }}
      onCancel={close}
      onOk={async () => {
        if (!entry || tooLarge) return;
        setSaving(true);
        try {
          if (await onSave(entry, encoded)) {
            setInitialContent(content);
            onClose();
          }
        } finally {
          setSaving(false);
        }
      }}
      destroyOnHidden
      className="server-files-editor-modal"
    >
      {loading ? (
        <div className="server-files-editor-loading">
          <Spin tip={t('serverFiles.states.loading')} />
        </div>
      ) : error ? (
        <Alert type="error" showIcon title={error} />
      ) : (
        <div className="server-files-editor-container">
          {tooLarge && (
            <Alert type="warning" showIcon title={t('serverFiles.errors.tooLarge')} />
          )}
          <Input.TextArea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            autoSize={{ minRows: 18, maxRows: 30 }}
            className="server-files-editor-input"
            spellCheck={false}
          />
          <div className="server-files-editor-footer">
            <Typography.Text type="secondary" className="server-files-editor-stat">
              {lineCount} 行 · {content.length} 字符 · UTF-8
            </Typography.Text>
            <Typography.Text
              type={tooLarge ? 'danger' : 'secondary'}
              className="server-files-editor-size"
            >
              {formatServerFileSize(encoded.byteLength)} / 200 KiB
            </Typography.Text>
          </div>
        </div>
      )}
    </Modal>
  );
}