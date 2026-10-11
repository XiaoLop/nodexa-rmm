import type { ServerFileEntry } from '@meshcentral/control-client';
import {
  EditOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { Alert, Button, Input, Modal, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  canEditServerFile,
  canPreviewServerFile,
  containsLikelyBinaryData,
  formatServerFileSize,
  MAX_EDIT_LIMIT_BYTES,
} from './serverFileViewModel';

interface ServerFileViewerModalProps {
  entry?: ServerFileEntry;
  initialMode?: 'preview' | 'edit';
  onRead: (entry: ServerFileEntry) => Promise<Uint8Array>;
  onSave: (entry: ServerFileEntry, data: Uint8Array) => Promise<boolean> | boolean;
  onClose: () => void;
}

export function ServerFileViewerModal({
  entry,
  initialMode = 'preview',
  onRead,
  onSave,
  onClose,
}: ServerFileViewerModalProps) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'preview' | 'edit'>(initialMode);
  const [content, setContent] = useState('');
  const [initialContent, setInitialContent] = useState('');
  const [imageUrl, setImageUrl] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const previewEligibility = useMemo(
    () => (entry ? canPreviewServerFile(entry) : undefined),
    [entry],
  );
  const editEligibility = useMemo(
    () => (entry ? canEditServerFile(entry) : undefined),
    [entry],
  );

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  useEffect(() => {
    if (!entry) {
      setImageUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return undefined;
      });
      setContent('');
      setError(undefined);
      return;
    }

    if (!previewEligibility?.allowed) {
      if (previewEligibility?.reason === 'unsupported_type') {
        setError(t('serverFiles.viewer.unsupportedType', '该文件类型不支持在线预览，仅支持特定图片或文本、脚本文件。'));
      } else if (previewEligibility?.reason === 'size_exceeded') {
        setError(
          t(
            'serverFiles.viewer.sizeExceeded',
            '文件大小超过 200 KiB 限制（当前 {{size}}），无法在线预览或编辑，请下载后查看。',
            { size: formatServerFileSize(entry.size) },
          ),
        );
      }
      return;
    }

    let active = true;
    setLoading(true);
    setError(undefined);

    void onRead(entry)
      .then((data) => {
        if (!active) return;
        if (previewEligibility.category === 'image') {
          const ext = entry.name.split('.').pop()?.toLowerCase() ?? 'png';
          const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
          const copyBuffer = new ArrayBuffer(data.byteLength);
          new Uint8Array(copyBuffer).set(data);
          const blob = new Blob([copyBuffer], { type: mime });
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
        } else {
          if (containsLikelyBinaryData(data)) {
            throw new Error(t('serverFiles.errors.binaryFile', '该文件包含二进制内容，无法预览或编辑。'));
          }
          const text = new TextDecoder('utf-8').decode(data);
          setContent(text);
          setInitialContent(text);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [entry, previewEligibility, onRead, t]);

  const encoded = useMemo(() => new TextEncoder().encode(content), [content]);
  const dirty = content !== initialContent;
  const tooLargeForEdit = encoded.byteLength >= MAX_EDIT_LIMIT_BYTES;
  const lineCount = useMemo(() => content.split('\n').length, [content]);

  const handleClose = () => {
    if (dirty && !window.confirm(t('serverFiles.editor.discardConfirm', '存在未保存的修改，确定关闭吗？'))) {
      return;
    }
    onClose();
  };

  const titleNode = entry ? (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
      <Space size={8}>
        {previewEligibility?.category === 'image' ? (
          <FileImageOutlined style={{ color: '#10b981', fontSize: 18 }} />
        ) : (
          <FileTextOutlined style={{ color: '#38bdf8', fontSize: 18 }} />
        )}
        <Typography.Text strong style={{ fontSize: 15 }}>
          {entry.name}
        </Typography.Text>
        <Tag color="blue">{formatServerFileSize(entry.size)}</Tag>
        {dirty && <Tag color="warning">{t('serverFiles.viewer.unsaved', '未保存')}</Tag>}
      </Space>

      {previewEligibility?.category === 'text' && editEligibility?.allowed && !error && (
        <Space size={6}>
          {mode === 'preview' ? (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => setMode('edit')}
            >
              {t('serverFiles.viewer.switchToEdit', '切换至编辑')}
            </Button>
          ) : (
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setMode('preview')}
            >
              {t('serverFiles.viewer.switchToPreview', '切换至预览')}
            </Button>
          )}
        </Space>
      )}
    </div>
  ) : null;

  return (
    <Modal
      open={Boolean(entry)}
      title={titleNode}
      width={previewEligibility?.category === 'image' ? 760 : 880}
      okText={mode === 'edit' ? t('common.actions.save', '保存') : t('common.actions.close', '关闭')}
      cancelText={t('common.actions.close', '关闭')}
      cancelButtonProps={{ style: mode === 'preview' ? { display: 'none' } : undefined }}
      okButtonProps={{
        disabled: loading || Boolean(error) || (mode === 'edit' && (!dirty || tooLargeForEdit)),
        loading: saving,
      }}
      onCancel={handleClose}
      onOk={async () => {
        if (mode === 'preview') {
          handleClose();
          return;
        }
        if (!entry || tooLargeForEdit) return;
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
    >
      {loading ? (
        <div style={{ padding: '60px 0', textAlign: 'center' }}>
          <Spin tip={t('serverFiles.states.loading', '正在读取文件...')} />
        </div>
      ) : error ? (
        <Alert type="error" showIcon message={error} style={{ margin: '16px 0' }} />
      ) : previewEligibility?.category === 'image' ? (
        <div
          style={{
            textAlign: 'center',
            padding: '20px 0',
            background: 'var(--color-surface-2, #182234)',
            borderRadius: 8,
          }}
        >
          {imageUrl && (
            <img
              src={imageUrl}
              alt={entry?.name}
              style={{
                maxWidth: '100%',
                maxHeight: '550px',
                objectFit: 'contain',
                borderRadius: 4,
              }}
            />
          )}
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          {mode === 'edit' ? (
            <>
              {tooLargeForEdit && (
                <Alert
                  type="warning"
                  showIcon
                  message={t('serverFiles.errors.tooLarge', '文本过大，超出保存上限。')}
                  style={{ marginBottom: 10 }}
                />
              )}
              <Input.TextArea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoSize={{ minRows: 18, maxRows: 30 }}
                style={{ fontFamily: 'Consolas, monospace', fontSize: 13 }}
                spellCheck={false}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 8,
                  fontSize: 12,
                }}
              >
                <Typography.Text type="secondary">
                  {lineCount} {t('serverFiles.viewer.lines', '行')} · {content.length}{' '}
                  {t('serverFiles.viewer.chars', '字符')} · UTF-8
                </Typography.Text>
                <Typography.Text type={tooLargeForEdit ? 'danger' : 'secondary'}>
                  {formatServerFileSize(encoded.byteLength)} / 200 KiB
                </Typography.Text>
              </div>
            </>
          ) : (
            <pre
              style={{
                background: 'var(--color-surface-2, #182234)',
                padding: '16px',
                borderRadius: '8px',
                maxHeight: '520px',
                overflow: 'auto',
                fontFamily: 'Consolas, monospace',
                fontSize: '13px',
                margin: 0,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {content || (
                <Typography.Text type="secondary">
                  {t('serverFiles.viewer.emptyFile', '（空文件）')}
                </Typography.Text>
              )}
            </pre>
          )}
        </div>
      )}
    </Modal>
  );
}
