import {
  ArrowUpOutlined,
  CompressOutlined,
  CopyOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOutlined,
  HddOutlined,
  HomeOutlined,
  InboxOutlined,
  ReloadOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { MeshCentralClient } from '@meshcentral/control-client';
import { joinFilePath, parentFilePath, type FileEntry } from '@meshcentral/relay';
import type { Device } from '@meshcentral/shared-state';
import {
  Alert,
  Button,
  Empty,
  Input,
  Modal,
  Progress,
  Space,
  Table,
  Tooltip,
  Typography,
  message,
  type TableColumnsType,
} from 'antd';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractFilesFromDataTransfer } from '../../../features/batch-upload/fileSystem';
import type { BatchUploadFileItem } from '../../../features/batch-upload/types';
import { useFormatters } from '../../../i18n/formatters';
import { DeviceFileUploadModal } from './DeviceFileUploadModal';
import { fileCommandAvailability, formatFileSize, sortFileEntries } from './fileViewModel';
import { useDeviceFilesSession } from './useDeviceFilesSession';

interface DeviceFilesPanelProps {
  device: Device;
  meshCentralClient?: MeshCentralClient;
  controlConnected: boolean;
  filesAllowed?: boolean;
}

type InputDialog = 'mkdir' | 'rename' | 'copy' | 'move' | 'zip' | 'unzip';

function entryIcon(entry: FileEntry) {
  if (entry.kind === 'drive') return <HddOutlined />;
  if (entry.kind === 'directory') return <FolderOutlined />;
  return <FileOutlined />;
}

export function DeviceFilesPanel(props: DeviceFilesPanelProps) {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const controller = useDeviceFilesSession(props);
  const [modal, modalContextHolder] = Modal.useModal();
  const [messageApi, messageContextHolder] = message.useMessage();
  const [dialog, setDialog] = useState<InputDialog>();
  const [dialogValue, setDialogValue] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [dragHoverDirectory, setDragHoverDirectory] = useState<string>();
  const [pendingUploadModal, setPendingUploadModal] = useState<{
    open: boolean;
    targetDirectory: string;
    files: BatchUploadFileItem[];
  }>({
    open: false,
    targetDirectory: '',
    files: [],
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const entries = useMemo(
    () => sortFileEntries(controller.listing?.entries ?? []),
    [controller.listing],
  );
  const availability = fileCommandAvailability(controller.selectedEntries);
  const disabled =
    controller.status !== 'ready' ||
    Boolean(controller.activeTransfer) ||
    Boolean(controller.archiveProgress);
  const parent = parentFilePath(controller.listing?.path ?? '');

  const handleDragEnter = (e: React.DragEvent) => {
    if (disabled) return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (disabled) return;
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingOver) setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDraggingOver(false);
      setDragHoverDirectory(undefined);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    const targetDir = dragHoverDirectory ?? controller.listing?.path ?? '';
    setDragHoverDirectory(undefined);
    if (disabled || !e.dataTransfer) return;
    if (!targetDir) {
      void messageApi.warning(t('deviceWorkspace.files.cannotUploadToRoot'));
      return;
    }

    try {
      const items = await extractFilesFromDataTransfer(e.dataTransfer);
      if (items.length > 0) {
        setPendingUploadModal({
          open: true,
          targetDirectory: targetDir,
          files: items,
        });
      }
    } catch {
      // Ignore read errors
    }
  };

  const openDialog = (type: InputDialog) => {
    const selected = controller.selectedEntries[0];
    const currentPath = controller.listing?.path ?? '';
    if (type === 'mkdir' && !currentPath) {
      void messageApi.warning(t('deviceWorkspace.files.cannotUploadToRoot'));
      return;
    }
    setDialog(type);
    setDialogValue(
      type === 'rename'
        ? (selected?.name ?? '')
        : type === 'zip'
          ? 'archive.zip'
          : type === 'unzip'
            ? joinFilePath(currentPath, selected?.name.replace(/\.zip$/i, '') || 'archive')
            : type === 'copy' || type === 'move'
              ? currentPath
              : '',
    );
  };

  const submitDialog = async () => {
    const value = dialogValue.trim();
    if (!dialog || !value) return;
    if (dialog === 'mkdir') await controller.createDirectory(value);
    if (dialog === 'rename') await controller.renameSelected(value);
    if (dialog === 'copy') await controller.copySelected(value);
    if (dialog === 'move') await controller.moveSelected(value);
    if (dialog === 'zip')
      controller.createZip(value.toLowerCase().endsWith('.zip') ? value : `${value}.zip`);
    if (dialog === 'unzip') controller.extractZip(value);
    setDialog(undefined);
  };

  const confirmRemove = () => {
    const includesDirectory = controller.selectedEntries.some((entry) => entry.kind !== 'file');
    modal.confirm({
      title: includesDirectory ? t('deviceWorkspace.files.deleteSelectionTitle') : t('deviceWorkspace.files.deleteFilesTitle'),
      content: includesDirectory
        ? t('deviceWorkspace.files.deleteDirectoryContent')
        : t('deviceWorkspace.files.deleteFilesContent', { count: controller.selectedEntries.length }),
      okText: t('common.actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.actions.cancel'),
      onOk: controller.removeSelected,
    });
  };

  const confirmRemoveEntry = (entry: FileEntry) => {
    modal.confirm({
      title: t('deviceWorkspace.files.deleteFilesTitle'),
      content: t('deviceWorkspace.files.deleteSingleFileContent', { name: entry.name }),
      okText: t('common.actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.actions.cancel'),
      onOk: () => controller.removeEntry(entry),
    });
  };

  const columns: TableColumnsType<FileEntry> = [
    {
      title: t('deviceWorkspace.files.columns.name'),
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string, entry) => (
        <button
          className={
            entry.kind === 'drive' || entry.kind === 'directory'
              ? 'device-files-entry-link'
              : 'device-files-entry-name'
          }
          type="button"
          onClick={() => {
            if (entry.kind === 'drive' || entry.kind === 'directory') {
              void controller.openDirectory(entry.path);
            }
          }}
        >
          {entryIcon(entry)}
          <span>{name}</span>
        </button>
      ),
    },
    {
      title: t('deviceWorkspace.files.columns.type'),
      dataIndex: 'kind',
      width: 100,
      className: 'device-files-secondary-column',
      render: (kind: FileEntry['kind']) =>
        ({ drive: t('deviceWorkspace.files.types.drive'), directory: t('deviceWorkspace.files.types.directory'), file: t('deviceWorkspace.files.types.file'), unknown: t('deviceWorkspace.files.types.unknown') })[kind],
    },
    {
      title: t('deviceWorkspace.files.columns.size'),
      dataIndex: 'size',
      width: 120,
      align: 'right',
      className: 'device-files-size-column',
      render: (size: number | undefined, entry) =>
        entry.kind === 'file' ? formatFileSize(size) : '—',
    },
    {
      title: t('deviceWorkspace.files.columns.modified'),
      dataIndex: 'modifiedAt',
      width: 180,
      className: 'device-files-time-column',
      render: (value?: Date) => value ? dateTime(value) : '—',
    },
    {
      title: t('deviceWorkspace.files.columns.actions'),
      key: 'actions',
      width: 90,
      align: 'center',
      render: (_, entry) =>
        entry.kind === 'file' ? (
          <Space size={0}>
            <Tooltip title={t('deviceWorkspace.files.downloadEntry', { name: entry.name })}>
              <Button
                type="text"
                icon={<DownloadOutlined />}
                aria-label={t('deviceWorkspace.files.downloadEntry', { name: entry.name })}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  void controller.download(entry);
                }}
              />
            </Tooltip>
            <Tooltip title={t('deviceWorkspace.files.deleteEntry', { name: entry.name })}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                aria-label={t('deviceWorkspace.files.deleteEntry', { name: entry.name })}
                disabled={disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  confirmRemoveEntry(entry);
                }}
              />
            </Tooltip>
          </Space>
        ) : null,
    },
  ];

  if (
    controller.status === 'forbidden' ||
    controller.status === 'offline' ||
    controller.status === 'disconnected'
  ) {
    const description =
      controller.status === 'forbidden'
        ? t('deviceWorkspace.files.forbidden')
        : controller.status === 'offline'
          ? t('deviceWorkspace.files.offline')
          : t('deviceWorkspace.files.disconnected');
    return (
      <section className="console-card workspace-tab-empty">
        <Empty description={description} />
      </section>
    );
  }

  return (
    <section
      className={`console-card device-files-panel ${isDraggingOver ? 'is-dragging-over' : ''}`}
      aria-busy={controller.status === 'connecting' || controller.status === 'busy'}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={(e) => void handleDrop(e)}
    >
      {modalContextHolder}
      {messageContextHolder}
      <div className="device-files-toolbar">
        <Space size={4} wrap>
          <Tooltip title={t('deviceWorkspace.files.up') }>
            <Button
              icon={<ArrowUpOutlined />}
              aria-label={t('deviceWorkspace.files.up')}
              disabled={disabled || parent === undefined}
              onClick={() => parent !== undefined && void controller.openDirectory(parent)}
            />
          </Tooltip>
          <Tooltip title={t('deviceWorkspace.files.root')}>
            <Button
              icon={<HomeOutlined />}
              aria-label={t('deviceWorkspace.files.root')}
              disabled={disabled || !controller.listing?.path}
              onClick={() => void controller.openDirectory('')}
            />
          </Tooltip>
          <Tooltip title={t('common.actions.refresh')}>
            <Button
              icon={<ReloadOutlined />}
              aria-label={t('common.actions.refresh')}
              disabled={disabled || !controller.listing}
              onClick={() => void controller.refresh()}
            />
          </Tooltip>
          <Tooltip title={t('deviceWorkspace.files.newDirectory')}>
            <Button
              icon={<FolderAddOutlined />}
              aria-label={t('deviceWorkspace.files.newDirectory')}
              disabled={disabled || !controller.listing?.path}
              onClick={() => openDialog('mkdir')}
            />
          </Tooltip>
          <Tooltip title={t('deviceWorkspace.files.upload')}>
            <Button
              icon={<UploadOutlined />}
              aria-label={t('deviceWorkspace.files.upload')}
              disabled={disabled || !controller.listing?.path}
              onClick={() => fileInputRef.current?.click()}
            />
          </Tooltip>
          <Tooltip title={t('deviceWorkspace.files.downloadSelected')}>
            <Button
              icon={<DownloadOutlined />}
              aria-label={t('deviceWorkspace.files.downloadSelected')}
              disabled={disabled || !availability.download}
              onClick={() =>
                controller.selectedEntries[0] &&
                void controller.download(controller.selectedEntries[0])
              }
            />
          </Tooltip>
          <Tooltip title={t('common.actions.rename')}>
            <Button
              icon={<EditOutlined />}
              aria-label={t('common.actions.rename')}
              disabled={disabled || !availability.rename}
              onClick={() => openDialog('rename')}
            />
          </Tooltip>
          <Tooltip title={t('deviceWorkspace.files.copy')}>
            <Button
              icon={<CopyOutlined />}
              aria-label={t('deviceWorkspace.files.copy')}
              disabled={disabled || !availability.copy}
              onClick={() => openDialog('copy')}
            />
          </Tooltip>
          <Tooltip title={t('deviceWorkspace.files.move')}>
            <Button
              icon={<SendOutlined />}
              aria-label={t('deviceWorkspace.files.move')}
              disabled={disabled || !availability.move}
              onClick={() => openDialog('move')}
            />
          </Tooltip>
          <Tooltip title={t('common.actions.delete')}>
            <Button
              danger
              icon={<DeleteOutlined />}
              aria-label={t('common.actions.delete')}
              disabled={disabled || !availability.remove}
              onClick={confirmRemove}
            />
          </Tooltip>
          <Tooltip title={t('deviceWorkspace.files.zip')}>
            <Button
              icon={<CompressOutlined />}
              aria-label={t('deviceWorkspace.files.zip')}
              disabled={disabled || !availability.zip}
              onClick={() => openDialog('zip')}
            />
          </Tooltip>
          <Tooltip title={t('deviceWorkspace.files.unzip')}>
            <Button
              icon={<FolderOutlined />}
              aria-label={t('deviceWorkspace.files.unzip')}
              disabled={disabled || !availability.unzip}
              onClick={() => openDialog('unzip')}
            />
          </Tooltip>
        </Space>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) {
              setPendingUploadModal({
                open: true,
                targetDirectory: controller.listing?.path ?? '',
                files: files.map((file) => ({
                  file,
                  relativePath: file.webkitRelativePath || file.name,
                })),
              });
            }
            event.target.value = '';
          }}
        />
      </div>

      <div className="device-files-pathbar">
        <Typography.Text type="secondary">{t('deviceWorkspace.files.currentPath')}</Typography.Text>
        <Typography.Text ellipsis={{ tooltip: controller.listing?.path || t('deviceWorkspace.files.root') }}>
          {controller.listing?.path || t('deviceWorkspace.files.root')}
        </Typography.Text>
      </div>

      {controller.error && (
        <Alert
          type="error"
          showIcon
          title={controller.error.raw ?? t(`deviceWorkspace.files.errors.${controller.error.code}`, { defaultValue: controller.error.code })}
          action={
            !controller.listing ? (
              <Button size="small" onClick={controller.reconnect}>
                {t('common.actions.reconnect')}
              </Button>
            ) : undefined
          }
        />
      )}

      <div className="device-files-table-wrap">
        <Table<FileEntry>
          size="small"
          rowKey="path"
          columns={columns}
          dataSource={entries}
          loading={
            controller.status === 'connecting' ||
            (controller.status === 'busy' && !controller.activeTransfer)
          }
          pagination={{ pageSize: 50, hideOnSinglePage: true, showSizeChanger: false }}
          scroll={{ y: 'calc(100vh - 390px)' }}
          rowSelection={{
            selectedRowKeys: controller.selectedPaths,
            onChange: (keys) => controller.setSelectedPaths(keys.map(String)),
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={controller.listing ? t('deviceWorkspace.files.emptyDirectory') : t('deviceWorkspace.files.readingDirectory')}
              />
            ),
          }}
          onRow={(entry) => ({
            onDoubleClick: () => {
              if (entry.kind === 'drive' || entry.kind === 'directory')
                void controller.openDirectory(entry.path);
            },
            onDragOver: (e) => {
              if (entry.kind === 'drive' || entry.kind === 'directory') {
                e.stopPropagation();
                setDragHoverDirectory(entry.path);
              }
            },
          })}
        />
        {isDraggingOver && (
          <div className="device-files-drop-overlay">
            <InboxOutlined className="device-files-drop-icon" />
            <div className="device-files-drop-text">
              {t('deviceWorkspace.files.dragDropHint')}
            </div>
            <div className="device-files-drop-subtext">
              {dragHoverDirectory
                ? `${t('deviceWorkspace.files.targetDirectory')}: ${dragHoverDirectory}`
                : controller.listing?.path
                  ? `${t('deviceWorkspace.files.targetDirectory')}: ${controller.listing.path}`
                  : t('deviceWorkspace.files.cannotUploadToRoot')}
            </div>
          </div>
        )}
      </div>

      <div className="device-files-statusbar">
        {controller.activeTransfer ? (
          <>
            <span>
              {controller.activeTransfer.kind === 'upload' ? t('deviceWorkspace.files.uploading') : t('deviceWorkspace.files.downloading')}：
              {controller.activeTransfer.name}
            </span>
            <Progress
              percent={Number((controller.activeTransfer.percentage ?? 0).toFixed(1))}
              size="small"
            />
            <Button size="small" danger onClick={controller.cancelTransfer}>
              {t('common.actions.cancel')}
            </Button>
          </>
        ) : controller.archiveProgress ? (
          <>
            <span title={controller.archiveProgress.file}>
              {controller.archiveProgress.type === 'unzipping'
                ? t('deviceWorkspace.files.unzipping')
                : controller.archiveProgress.type === 'zipping-file'
                  ? t('deviceWorkspace.files.zippingFile', { file: controller.archiveProgress.file ?? '' })
                  : t('deviceWorkspace.files.preparingZip')}
            </span>
            {controller.archiveProgress.progress !== undefined && (
              <Progress
                percent={Math.max(0, Math.min(100, controller.archiveProgress.progress))}
                size="small"
              />
            )}
          </>
        ) : (
          <span>
            {controller.selectedEntries.length > 0
              ? t('deviceWorkspace.files.selectedCount', { count: controller.selectedEntries.length })
              : t('deviceWorkspace.files.entryCount', { count: entries.length })}
          </span>
        )}
      </div>

      <Modal
        open={Boolean(dialog)}
        title={
          (
            {
              mkdir: t('deviceWorkspace.files.dialogs.mkdir'),
              rename: t('deviceWorkspace.files.dialogs.rename'),
              copy: t('deviceWorkspace.files.dialogs.copy'),
              move: t('deviceWorkspace.files.dialogs.move'),
              zip: t('deviceWorkspace.files.dialogs.zip'),
              unzip: t('deviceWorkspace.files.dialogs.unzip'),
            } as Record<InputDialog, string>
          )[dialog ?? 'mkdir']
        }
        okText={t('common.actions.confirm')}
        cancelText={t('common.actions.cancel')}
        onOk={() => void submitDialog()}
        onCancel={() => setDialog(undefined)}
        okButtonProps={{ disabled: !dialogValue.trim() }}
      >
        <Input
          autoFocus
          value={dialogValue}
          prefix={dialog === 'copy' || dialog === 'move' ? <CopyOutlined /> : undefined}
          onChange={(event) => setDialogValue(event.target.value)}
          onPressEnter={() => void submitDialog()}
        />
      </Modal>

      <DeviceFileUploadModal
        open={pendingUploadModal.open}
        targetDirectory={pendingUploadModal.targetDirectory}
        files={pendingUploadModal.files}
        onClose={() => setPendingUploadModal({ open: false, targetDirectory: '', files: [] })}
        onConfirm={(confirmedFiles, options) => {
          void controller.uploadFiles(confirmedFiles, pendingUploadModal.targetDirectory, options);
        }}
      />
    </section>
  );
}
