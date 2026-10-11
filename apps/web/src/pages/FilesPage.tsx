import {
  ArrowUpOutlined,
  CloseOutlined,
  CodeOutlined,
  CopyOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EllipsisOutlined,
  EyeOutlined,
  FileImageOutlined,
  FileOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileZipOutlined,
  FolderAddOutlined,
  FolderFilled,
  FolderOpenOutlined,
  FormOutlined,
  HomeOutlined,
  InboxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ReloadOutlined,
  SearchOutlined,
  SendOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
} from '@ant-design/icons';
import {
  MAX_SERVER_FILE_BYTES,
  type ServerFileEntry,
} from '@meshcentral/control-client';
import {
  Alert,
  Badge,
  Breadcrumb,
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
  type MenuProps,
  type TableColumnsType,
} from 'antd';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { FilterBar, PageHeader, Panel } from '../components/ui';
import { ServerFileDestinationDialog } from '../features/server-files/ServerFileDestinationDialog';
import { ServerFileViewerModal } from '../features/server-files/ServerFileViewerModal';
import { ServerFileUploadDrawer } from '../features/server-files/ServerFileUploadDrawer';
import {
  scanFilesFromDataTransfer,
  type StagedUploadFile,
} from '../features/server-files/fileDirectoryScanner';
import {
  BatchUploadManager,
  type BatchUploadItem,
  type BatchUploadSummary,
} from '../features/server-files/chunkUploadService';
import {
  canEditServerFile,
  canPreviewServerFile,
  formatServerFileSize,
  serverFileCommandAvailability,
  sortServerFileEntries,
} from '../features/server-files/serverFileViewModel';
import { useServerFiles } from '../features/server-files/useServerFiles';
import { useMeshCentralControlData } from '../features/gateway';
import { useFormatters } from '../i18n/formatters';
import '../assets/styles/server-files.css';

type NameDialog = 'create' | 'rename';
type TransferDialog = 'copy' | 'move';
const COLLAPSED_STORAGE_KEY = 'mesh_server_files_spaces_collapsed';

function getFileGlyph(entry: ServerFileEntry) {
  if (entry.kind === 'directory') {
    return <FolderFilled className="server-file-glyph is-folder" />;
  }
  const ext = entry.name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext)) {
    return <FileImageOutlined className="server-file-glyph is-image" />;
  }
  if (['zip', 'tar', 'gz', 'tgz', '7z', 'rar', 'bz2'].includes(ext)) {
    return <FileZipOutlined className="server-file-glyph is-zip" />;
  }
  if (ext === 'pdf') {
    return <FilePdfOutlined className="server-file-glyph is-pdf" />;
  }
  if (
    [
      'js',
      'ts',
      'jsx',
      'tsx',
      'py',
      'sh',
      'bat',
      'ps1',
      'json',
      'yaml',
      'yml',
      'xml',
      'html',
      'css',
      'sql',
      'c',
      'cpp',
      'h',
      'rs',
      'go',
      'java',
    ].includes(ext)
  ) {
    return <CodeOutlined className="server-file-glyph is-code" />;
  }
  if (['txt', 'md', 'log', 'csv', 'ini', 'conf', 'env'].includes(ext)) {
    return <FileTextOutlined className="server-file-glyph is-text" />;
  }
  return <FileOutlined className="server-file-glyph is-generic" />;
}

export function FilesPage() {
  const { t } = useTranslation();
  const { dateTime } = useFormatters();
  const [searchParams, setSearchParams] = useSearchParams();
  const data = useMeshCentralControlData();
  const controller = useServerFiles({
    client: data.client,
    connected: data.status === 'connected',
  });
  const [modal, modalContextHolder] = Modal.useModal();
  const [nameDialog, setNameDialog] = useState<NameDialog>();
  const [nameValue, setNameValue] = useState('');
  const [transferDialog, setTransferDialog] = useState<TransferDialog>();
  const [actionTargetEntry, setActionTargetEntry] = useState<ServerFileEntry>();
  const [viewerEntry, setViewerEntry] = useState<ServerFileEntry>();
  const [viewerMode, setViewerMode] = useState<'preview' | 'edit'>('preview');
  const [uploadDrawerOpen, setUploadDrawerOpen] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedUploadFile[]>([]);
  const [isScanningDrop, setIsScanningDrop] = useState(false);
  const [batchItems, setBatchItems] = useState<BatchUploadItem[]>([]);
  const [batchSummary, setBatchSummary] = useState<BatchUploadSummary>();
  const batchManagerRef = useRef<BatchUploadManager | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [spacesCollapsed, setSpacesCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleSpacesCollapsed = () => {
    setSpacesCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore localStorage errors
      }
      return next;
    });
  };

  // Synchronize space from URL query parameters (e.g. ?groupId=mesh//xyz or ?spaceId=xyz)
  useEffect(() => {
    const targetSpaceId = searchParams.get('spaceId') || searchParams.get('groupId');
    if (!targetSpaceId || !controller.tree?.spaces?.length) return;

    const matched = controller.tree.spaces.find(
      (space) =>
        space.id === targetSpaceId ||
        space.id === `mesh//${targetSpaceId}` ||
        `mesh//${space.id}` === targetSpaceId,
    );

    if (matched && controller.currentSpace?.id !== matched.id) {
      controller.openSpace(matched.id);
      setSearchQuery('');
    }
  }, [controller, searchParams]);

  const handleSelectSpace = (spaceId: string) => {
    controller.openSpace(spaceId);
    setSearchQuery('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('spaceId', spaceId);
    nextParams.delete('groupId');
    setSearchParams(nextParams, { replace: true });
  };

  const rawSortedEntries = useMemo(
    () => sortServerFileEntries(controller.entries),
    [controller.entries],
  );

  const entries = useMemo(() => {
    if (!searchQuery.trim()) return rawSortedEntries;
    const query = searchQuery.trim().toLowerCase();
    return rawSortedEntries.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [rawSortedEntries, searchQuery]);

  // Disable nested table tree expansion: folders are navigated by clicking, not expanded inline
  const tableEntries = useMemo(
    () =>
      entries.map((entry) =>
        entry.children !== undefined ? { ...entry, children: undefined } : entry,
      ),
    [entries],
  );

  const availability = serverFileCommandAvailability(controller.selectedEntries);
  const disabled = !controller.connected || controller.busy || controller.loading;
  const selectedNames = controller.selectedEntries.map((entry) => entry.name);

  const totalFolders = useMemo(
    () => rawSortedEntries.filter((e) => e.kind === 'directory').length,
    [rawSortedEntries],
  );
  const totalFiles = useMemo(
    () => rawSortedEntries.filter((e) => e.kind === 'file').length,
    [rawSortedEntries],
  );

  const openNameDialog = (dialog: NameDialog, target?: ServerFileEntry) => {
    setActionTargetEntry(target);
    setNameDialog(dialog);
    if (dialog === 'rename') {
      const initialName = target?.name ?? controller.selectedEntries[0]?.name ?? '';
      setNameValue(initialName);
    } else {
      setNameValue('');
    }
  };

  const hasConflict = (name: string) => {
    const currentRenameName =
      actionTargetEntry?.name ?? controller.selectedEntries[0]?.name;
    return controller.entries.some(
      (entry) =>
        entry.name.toLocaleLowerCase() === name.toLocaleLowerCase() &&
        (nameDialog !== 'rename' || entry.name !== currentRenameName),
    );
  };

  const submitNameDialog = async () => {
    const name = nameValue.trim();
    if (!name) return;
    if (hasConflict(name)) {
      modal.error({ title: t('serverFiles.errors.nameConflict') });
      return;
    }
    const target = actionTargetEntry ?? controller.selectedEntries[0];
    const succeeded =
      nameDialog === 'create'
        ? await controller.createFolder(name)
        : target
          ? await controller.rename(target.name, name)
          : false;

    if (succeeded) {
      setNameDialog(undefined);
      setActionTargetEntry(undefined);
    }
  };

  const download = async (entry: ServerFileEntry) => {
    if ((entry.size ?? 0) >= MAX_SERVER_FILE_BYTES) return;
    try {
      const bytes = await controller.readFile(entry);
      const buffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(buffer).set(bytes);
      const url = URL.createObjectURL(new Blob([buffer]));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = entry.name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      modal.error({
        title: t('serverFiles.errors.downloadFailed'),
        content:
          downloadError instanceof Error ? downloadError.message : String(downloadError),
      });
    }
  };

  useEffect(() => {
    return () => {
      batchManagerRef.current?.destroy();
    };
  }, []);

  const uploadStagedFiles = async (filesToUploadList: StagedUploadFile[]) => {
    if (!controller.currentSpace || filesToUploadList.length === 0) return;

    // 冲突检查：检查直属在当前层级下的同名普通文件
    const existingFileNames = new Set(
      controller.entries
        .filter((entry) => entry.kind !== 'directory')
        .map((entry) => entry.name.toLocaleLowerCase()),
    );
    const conflictingItems = filesToUploadList.filter(
      (item) =>
        item.subPath.length === 0 &&
        existingFileNames.has(item.file.name.toLocaleLowerCase()),
    );

    let finalUploadList = filesToUploadList;

    if (conflictingItems.length > 0) {
      const isSingle = conflictingItems.length === 1 && filesToUploadList.length === 1;
      const shouldOverwrite = await modal.confirm({
        title: isSingle
          ? t('serverFiles.upload.overwriteTitle', '文件已存在')
          : t('serverFiles.upload.batchConflictTitle', '检测到同名文件'),
        content: isSingle
          ? t('serverFiles.upload.overwriteDescription', { name: conflictingItems[0]?.file.name ?? '' })
          : t(
              'serverFiles.upload.batchConflictDesc',
              '选中的文件中包含 {{count}} 个已存在的同名文件 (如: {{names}})，是否覆盖？',
              {
                count: conflictingItems.length,
                names:
                  conflictingItems.slice(0, 3).map((f) => f.file.name).join(', ') +
                  (conflictingItems.length > 3 ? '...' : ''),
              },
            ),
        okText: isSingle
          ? t('serverFiles.upload.overwrite', '覆盖')
          : t('serverFiles.upload.overwriteAll', '全部覆盖'),
        cancelText: isSingle
          ? t('common.actions.cancel', '取消')
          : t('serverFiles.upload.skipConflicts', '跳过同名'),
      });

      if (!shouldOverwrite) {
        if (isSingle) {
          return;
        }
        finalUploadList = filesToUploadList.filter(
          (item) =>
            item.subPath.length > 0 ||
            !existingFileNames.has(item.file.name.toLocaleLowerCase()),
        );
        if (finalUploadList.length === 0) {
          message.info(t('serverFiles.upload.allSkipped', '所有同名文件均已跳过'));
          return;
        }
      }
    }

    if (batchManagerRef.current) {
      batchManagerRef.current.destroy();
    }

    const relativePath = controller.currentPath.slice(1);
    const manager = new BatchUploadManager(controller.currentSpace.id, relativePath, {
      onStateChange: (items, summary) => {
        setBatchItems(items);
        setBatchSummary(summary);
      },
      onFileCompleted: () => {
        void controller.refresh();
      },
      onAllCompleted: (summary) => {
        void controller.refresh();
        if (summary.failedFiles === 0) {
          message.success(t('serverFiles.upload.batchSuccess', '文件已全部成功上传'));
        } else {
          message.warning(
            t(
              'serverFiles.upload.batchPartial',
              '部分文件上传完成，{{failed}} 个文件失败',
              { failed: summary.failedFiles },
            ),
          );
        }
      },
    });

    batchManagerRef.current = manager;
    manager.addFiles(
      finalUploadList.map((item) => ({
        file: item.file,
        subPath: item.subPath,
        relativePath: item.relativePath,
      })),
    );
  };

  const confirmRemove = (targetNames = selectedNames) => {
    if (!targetNames.length) return;
    const recursive = controller.entries.some(
      (entry) => targetNames.includes(entry.name) && entry.kind === 'directory',
    );
    modal.confirm({
      title: t('serverFiles.delete.title'),
      content: recursive
        ? t('serverFiles.delete.recursiveDescription')
        : t('serverFiles.delete.description', { count: targetNames.length }),
      okText: t('common.actions.delete'),
      okButtonProps: { danger: true },
      cancelText: t('common.actions.cancel'),
      onOk: () => controller.remove(targetNames, recursive),
    });
  };

  const copyCurrentPath = () => {
    const pathStr = '/' + controller.currentPath.slice(1).join('/');
    void navigator.clipboard.writeText(pathStr || '/');
    message.success(t('serverFiles.pathCopied'));
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!disabled && controller.currentSpace && !isDraggingOver) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.contains(event.relatedTarget as Node)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingOver(false);
    if (disabled || !controller.currentSpace || !event.dataTransfer) return;

    setIsScanningDrop(true);
    setUploadDrawerOpen(true);
    try {
      const { files, exceededMaxLimit } = await scanFilesFromDataTransfer(event.dataTransfer);
      if (exceededMaxLimit) {
        message.warning(
          t(
            'serverFiles.upload.maxFilesScanned',
            '已达到单次扫描上限（1000个文件），超出部分已被忽略。建议将过大目录打包上传。',
          ),
        );
      }
      setStagedFiles((prev) => {
        const map = new Map<string, StagedUploadFile>();
        for (const item of prev) map.set(item.relativePath, item);
        for (const item of files) map.set(item.relativePath, item);
        return Array.from(map.values());
      });
    } finally {
      setIsScanningDrop(false);
    }
  };

  const getRowMenuItems = (entry: ServerFileEntry): MenuProps['items'] => {
    const previewEligible = canPreviewServerFile(entry);
    const editEligible = canEditServerFile(entry);

    return [
      ...(previewEligible.allowed
        ? [
            {
              key: 'preview',
              label: t('serverFiles.actions.preview', '预览'),
              icon: <EyeOutlined />,
              disabled,
              onClick: () => {
                setViewerEntry(entry);
                setViewerMode('preview');
              },
            },
          ]
        : []),
      ...(editEligible.allowed
        ? [
            {
              key: 'edit',
              label: t('serverFiles.actions.edit'),
              icon: <EditOutlined />,
              disabled,
              onClick: () => {
                setViewerEntry(entry);
                setViewerMode('edit');
              },
            },
          ]
        : []),
      {
        key: 'rename',
        label: t('common.actions.rename'),
        icon: <FormOutlined />,
        disabled,
        onClick: () => openNameDialog('rename', entry),
      },
    {
      key: 'copy',
      label: t('serverFiles.actions.copy'),
      icon: <CopyOutlined />,
      disabled: disabled || entry.kind !== 'file',
      onClick: () => {
        setActionTargetEntry(entry);
        setTransferDialog('copy');
      },
    },
    {
      key: 'move',
      label: t('serverFiles.actions.move'),
      icon: <SendOutlined />,
      disabled: disabled || entry.kind !== 'file',
      onClick: () => {
        setActionTargetEntry(entry);
        setTransferDialog('move');
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'delete',
      label: t('common.actions.delete'),
      icon: <DeleteOutlined />,
      danger: true,
      disabled,
      onClick: () => confirmRemove([entry.name]),
    },
  ];
};

  const columns: TableColumnsType<ServerFileEntry> = [
    {
      title: t('serverFiles.columns.name'),
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string, entry) => (
        <button
          type="button"
          className={
            entry.kind === 'directory'
              ? 'server-file-entry is-directory'
              : 'server-file-entry'
          }
          onClick={() => {
            if (entry.kind === 'directory') {
              controller.openDirectory(entry);
              setSearchQuery('');
            }
          }}
        >
          {getFileGlyph(entry)}
          <span className="server-file-entry-text" title={name}>
            {name}
          </span>
        </button>
      ),
    },
    {
      title: t('serverFiles.columns.type'),
      dataIndex: 'kind',
      width: 110,
      className: 'server-files-secondary-column',
      render: (kind: ServerFileEntry['kind']) => (
        <Tag
          bordered={false}
          className={
            kind === 'directory' ? 'server-file-tag is-folder' : 'server-file-tag is-file'
          }
        >
          {t(`serverFiles.types.${kind}`)}
        </Tag>
      ),
    },
    {
      title: t('serverFiles.columns.size'),
      dataIndex: 'size',
      width: 120,
      align: 'right',
      render: (size: number | undefined, entry) => (
        <span className="server-file-size-cell">
          {entry.kind === 'file' ? formatServerFileSize(size) : '—'}
        </span>
      ),
    },
    {
      title: t('serverFiles.columns.modified'),
      dataIndex: 'modifiedAt',
      width: 190,
      className: 'server-files-secondary-column',
      render: (value?: Date) => (
        <span className="server-file-date-cell">
          {value ? dateTime(value) : '—'}
        </span>
      ),
    },
    {
      title: t('serverFiles.columns.actions'),
      key: 'actions',
      width: 130,
      align: 'center',
      render: (_, entry) => {
        const previewEligible = canPreviewServerFile(entry);
        const editEligible = canEditServerFile(entry);
        const canDownload =
          entry.kind === 'file' && (entry.size ?? 0) < MAX_SERVER_FILE_BYTES;

        return (
          <Space size={2} className="server-file-row-actions">
            {previewEligible.allowed && (
              <Tooltip title={t('serverFiles.actions.preview', '预览')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerEntry(entry);
                    setViewerMode('preview');
                  }}
                />
              </Tooltip>
            )}
            {editEligible.allowed && (
              <Tooltip title={t('serverFiles.actions.edit')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    setViewerEntry(entry);
                    setViewerMode('edit');
                  }}
                />
              </Tooltip>
            )}
            {canDownload && (
              <Tooltip title={t('serverFiles.actions.download')}>
                <Button
                  type="text"
                  size="small"
                  icon={<DownloadOutlined />}
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    void download(entry);
                  }}
                />
              </Tooltip>
            )}
            <Dropdown
              menu={{ items: getRowMenuItems(entry) }}
              trigger={['click']}
              placement="bottomRight"
            >
              <Button
                type="text"
                size="small"
                icon={<EllipsisOutlined />}
                disabled={disabled}
                onClick={(e) => e.stopPropagation()}
              />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const destinationSelectedNames = actionTargetEntry
    ? [actionTargetEntry.name]
    : selectedNames;

  const personalSpaces = useMemo(
    () => controller.tree?.spaces?.filter((space) => space.kind === 'user') ?? [],
    [controller.tree?.spaces],
  );
  const deviceGroupSpaces = useMemo(
    () => controller.tree?.spaces?.filter((space) => space.kind === 'mesh') ?? [],
    [controller.tree?.spaces],
  );

  const renderSpaceItem = (space: (typeof personalSpaces)[number]) => {
    const selected = space.id === controller.currentSpace?.id;
    const percent = space.maxBytes
      ? Math.min(100, Math.round((space.usedBytes / space.maxBytes) * 100))
      : 0;

    let progressColor = '#3b82f6';
    if (percent >= 90) progressColor = '#ef4444';
    else if (percent >= 75) progressColor = '#f59e0b';

    const tooltipContent = (
      <div>
        <div style={{ fontWeight: 600 }}>{space.name}</div>
        <div>
          {formatServerFileSize(space.usedBytes)}
          {space.maxBytes ? ` / ${formatServerFileSize(space.maxBytes)}` : ''}
        </div>
      </div>
    );

    if (spacesCollapsed) {
      return (
        <Tooltip key={space.id} title={tooltipContent} placement="right">
          <button
            type="button"
            className={`server-file-space-item-collapsed ${selected ? 'is-selected' : ''}`}
            onClick={() => handleSelectSpace(space.id)}
            aria-label={space.name}
          >
            <span
              className={`server-file-space-icon-box ${
                space.kind === 'user' ? 'is-user' : 'is-team'
              }`}
            >
              {space.kind === 'user' ? <UserOutlined /> : <TeamOutlined />}
            </span>
          </button>
        </Tooltip>
      );
    }

    return (
      <div
        key={space.id}
        className={`server-file-space-item ${selected ? 'is-selected' : ''}`}
        onClick={() => handleSelectSpace(space.id)}
      >
        <div className="server-file-space-item-content">
          <span
            className={`server-file-space-icon-box ${
              space.kind === 'user' ? 'is-user' : 'is-team'
            }`}
          >
            {space.kind === 'user' ? <UserOutlined /> : <TeamOutlined />}
          </span>
          <div className="server-file-space-details">
            <Typography.Text
              className="server-file-space-name"
              ellipsis={{ tooltip: space.name }}
            >
              {space.name}
            </Typography.Text>
            <div className="server-file-space-usage">
              {formatServerFileSize(space.usedBytes)}
              {space.maxBytes ? ` / ${formatServerFileSize(space.maxBytes)}` : ''}
            </div>
          </div>
        </div>
        {space.maxBytes !== undefined && (
          <div className="server-file-space-progress-wrap">
            <Progress
              percent={percent}
              showInfo={false}
              size="small"
              strokeColor={progressColor}
              trailColor="var(--color-surface-2, rgba(255, 255, 255, 0.08))"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page-stack server-files-page">
      {modalContextHolder}

      <PageHeader
        title={t('serverFiles.title')}
        description={t('serverFiles.subtitle')}
        actions={
          <Space>
            <Tooltip title={t('common.actions.refresh')}>
              <Button
                icon={<ReloadOutlined />}
                disabled={disabled}
                onClick={() => void controller.refresh()}
              >
                {t('common.actions.refresh')}
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              disabled={disabled || !controller.currentSpace}
              onClick={() => setUploadDrawerOpen(true)}
            >
              {t('serverFiles.actions.upload')}
            </Button>
            <Button
              icon={<FolderAddOutlined />}
              disabled={disabled || !controller.currentSpace}
              onClick={() => openNameDialog('create')}
            >
              {t('serverFiles.actions.createFolder')}
            </Button>
          </Space>
        }
      />

      {!controller.connected && (
        <Alert
          type="warning"
          showIcon
          title={t('serverFiles.states.disconnectedNotice')}
        />
      )}
      {controller.error && (
        <Alert
          type="error"
          showIcon
          closable
          title={t('serverFiles.states.operationUnconfirmed')}
          description={controller.error}
          onClose={controller.clearError}
        />
      )}

      <div
        className={`server-files-layout ${
          spacesCollapsed ? 'is-spaces-collapsed' : ''
        }`}
      >
        <Panel
          className="server-files-spaces-panel"
          title={
            spacesCollapsed ? undefined : (
              <span className="server-files-spaces-panel-title">
                <DatabaseOutlined />
                <span>{t('serverFiles.spaces.title')}</span>
                {controller.tree?.spaces && controller.tree.spaces.length > 0 && (
                  <Tag bordered={false} className="server-files-spaces-count">
                    {controller.tree.spaces.length}
                  </Tag>
                )}
              </span>
            )
          }
          tools={
            <Tooltip
              title={
                spacesCollapsed
                  ? t('serverFiles.spaces.expand')
                  : t('serverFiles.spaces.collapse')
              }
              placement="right"
            >
              <Button
                type="text"
                size="small"
                className="server-files-collapse-btn"
                icon={spacesCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={toggleSpacesCollapsed}
                aria-label={
                  spacesCollapsed
                    ? t('serverFiles.spaces.expand')
                    : t('serverFiles.spaces.collapse')
                }
              />
            </Tooltip>
          }
        >
          <div className="server-files-spaces-body">
            {!controller.tree?.spaces?.length ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={t('serverFiles.spaces.empty')}
              />
            ) : (
              <>
                {personalSpaces.length > 0 && (
                  <div className="server-files-space-group">
                    {!spacesCollapsed && (
                      <div className="server-files-space-group-label">
                        <UserOutlined />
                        <span>{t('serverFiles.spaces.personal')}</span>
                      </div>
                    )}
                    <div className="server-files-space-group-list">
                      {personalSpaces.map(renderSpaceItem)}
                    </div>
                  </div>
                )}
                {deviceGroupSpaces.length > 0 && (
                  <div className="server-files-space-group">
                    {!spacesCollapsed && (
                      <div className="server-files-space-group-label">
                        <TeamOutlined />
                        <span>{t('serverFiles.spaces.deviceGroups')}</span>
                      </div>
                    )}
                    <div className="server-files-space-group-list">
                      {deviceGroupSpaces.map(renderSpaceItem)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </Panel>

        <Panel
          className={`server-files-browser-panel ${isDraggingOver ? 'is-dragging-over' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDraggingOver && (
            <div className="server-files-drop-overlay">
              <div className="server-files-drop-box">
                <InboxOutlined className="server-files-drop-icon" />
                <div className="server-files-drop-title">
                  {t('serverFiles.dropHint')}
                </div>
              </div>
            </div>
          )}

          <FilterBar className="server-files-filter-bar">
            <div className="server-files-filter-left">
              <Tooltip title={t('serverFiles.actions.up')}>
                <Button
                  size="small"
                  icon={<ArrowUpOutlined />}
                  aria-label={t('serverFiles.actions.up')}
                  disabled={disabled || controller.currentPath.length <= 1}
                  onClick={() => {
                    controller.openPath(controller.currentPath.slice(0, -1));
                    setSearchQuery('');
                  }}
                />
              </Tooltip>

              <Breadcrumb
                className="server-files-breadcrumb"
                items={controller.currentPath.map((segment, index) => {
                  const isFirst = index === 0;
                  const isLast = index === controller.currentPath.length - 1;
                  const displayName = isFirst
                    ? controller.currentSpace?.name ?? segment
                    : segment;

                  return {
                    title: (
                      <button
                        type="button"
                        className={`server-files-breadcrumb-btn ${
                          isLast ? 'is-active' : ''
                        }`}
                        onClick={() => {
                          controller.openPath(
                            controller.currentPath.slice(0, index + 1),
                          );
                          setSearchQuery('');
                        }}
                      >
                        {isFirst ? (
                          controller.currentSpace?.kind === 'user' ? (
                            <HomeOutlined className="server-files-breadcrumb-icon" />
                          ) : (
                            <TeamOutlined className="server-files-breadcrumb-icon" />
                          )
                        ) : (
                          <FolderOpenOutlined className="server-files-breadcrumb-icon" />
                        )}
                        <span>{displayName}</span>
                      </button>
                    ),
                  };
                })}
              />

              <Tooltip title={t('serverFiles.copyPath')}>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={copyCurrentPath}
                />
              </Tooltip>
            </div>

            <div className="server-files-filter-right">
              {selectedNames.length > 0 && (
                <div className="server-files-inline-actions">
                  <Badge count={selectedNames.length} color="#3b82f6" />
                  <Space size={4}>
                    {availability.download && (
                      <Tooltip title={t('serverFiles.actions.download')}>
                        <Button
                          size="small"
                          icon={<DownloadOutlined />}
                          onClick={() =>
                            controller.selectedEntries[0] &&
                            void download(controller.selectedEntries[0])
                          }
                        />
                      </Tooltip>
                    )}
                    {availability.edit && (
                      <Tooltip title={t('serverFiles.actions.edit')}>
                        <Button
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => {
                            const target = controller.selectedEntries[0];
                            if (target) {
                              setViewerEntry(target);
                              setViewerMode('edit');
                            }
                          }}
                        />
                      </Tooltip>
                    )}
                    {availability.rename && (
                      <Tooltip title={t('common.actions.rename')}>
                        <Button
                          size="small"
                          icon={<FormOutlined />}
                          onClick={() => openNameDialog('rename')}
                        />
                      </Tooltip>
                    )}
                    <Tooltip title={t('serverFiles.actions.copy')}>
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        disabled={disabled || !availability.copy}
                        onClick={() => {
                          setActionTargetEntry(undefined);
                          setTransferDialog('copy');
                        }}
                      />
                    </Tooltip>
                    <Tooltip title={t('serverFiles.actions.move')}>
                      <Button
                        size="small"
                        icon={<SendOutlined />}
                        disabled={disabled || !availability.move}
                        onClick={() => {
                          setActionTargetEntry(undefined);
                          setTransferDialog('move');
                        }}
                      />
                    </Tooltip>
                    <Tooltip title={t('common.actions.delete')}>
                      <Button
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        disabled={disabled || !availability.remove}
                        onClick={() => confirmRemove()}
                      />
                    </Tooltip>
                    <Button
                      size="small"
                      type="text"
                      icon={<CloseOutlined />}
                      onClick={() => controller.setSelectedPaths([])}
                    />
                  </Space>
                  <div className="server-files-toolbar-divider" />
                </div>
              )}

              <Input
                placeholder={t('serverFiles.searchPlaceholder')}
                prefix={<SearchOutlined className="server-files-search-icon" />}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                allowClear
                className="server-files-search-input"
              />
            </div>
          </FilterBar>

          <div className="server-files-table-wrapper">
            {controller.currentSpace ? (
              <Table<ServerFileEntry>
                size="middle"
                rowKey={(entry) => entry.path.join('\u0000')}
                columns={columns}
                dataSource={tableEntries}
                expandable={{
                  childrenColumnName: '__none__',
                }}
                loading={controller.loading || controller.busy}
                pagination={{
                  pageSize: 50,
                  hideOnSinglePage: true,
                  showSizeChanger: false,
                }}
                scroll={{ y: 'calc(100vh - 350px)' }}
                rowSelection={{
                  selectedRowKeys: controller.selectedPaths,
                  onChange: (keys) => controller.setSelectedPaths(keys.map(String)),
                }}
                onRow={(record) => ({
                  onDoubleClick: () => {
                    if (record.kind === 'directory') {
                      controller.openDirectory(record);
                      setSearchQuery('');
                      return;
                    }
                    const previewCheck = canPreviewServerFile(record);
                    if (previewCheck.allowed) {
                      setViewerEntry(record);
                      setViewerMode('preview');
                    } else if (previewCheck.reason === 'size_exceeded') {
                      modal.info({
                        title: t('serverFiles.viewer.cannotPreview', '文件无法在线预览'),
                        content: t(
                          'serverFiles.viewer.sizeExceededDetail',
                          '该文件大小为 {{size}}，超过在线预览与编辑最大限制（200 KiB），请下载后查看。',
                          { size: formatServerFileSize(record.size) },
                        ),
                      });
                    } else {
                      modal.info({
                        title: t('serverFiles.viewer.notSupported', '不支持在线预览'),
                        content: t(
                          'serverFiles.viewer.unsupportedDetail',
                          '当前文件类型不支持在线预览，仅支持特定图片（PNG、JPG等）或文本、脚本文件。',
                        ),
                      });
                    }
                  },
                })}
                locale={{
                  emptyText: searchQuery ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={t('serverFiles.stats.filtered', {
                        count: 0,
                        total: rawSortedEntries.length,
                      })}
                    >
                      <Button size="small" onClick={() => setSearchQuery('')}>
                        {t('serverFiles.clearSearch')}
                      </Button>
                    </Empty>
                  ) : (
                    <div className="server-files-empty-state">
                      <FolderOpenOutlined className="server-files-empty-icon" />
                      <div className="server-files-empty-title">
                        {t('serverFiles.emptyFolder')}
                      </div>
                      <div className="server-files-empty-desc">
                        {t('serverFiles.emptyFolderDesc')}
                      </div>
                      <Space size={10} className="server-files-empty-actions">
                        <Button
                          type="primary"
                          icon={<UploadOutlined />}
                          disabled={disabled}
                          onClick={() => setUploadDrawerOpen(true)}
                        >
                          {t('serverFiles.actions.upload')}
                        </Button>
                        <Button
                          icon={<FolderAddOutlined />}
                          disabled={disabled}
                          onClick={() => openNameDialog('create')}
                        >
                          {t('serverFiles.actions.createFolder')}
                        </Button>
                      </Space>
                    </div>
                  ),
                }}
              />
            ) : (
              <Empty
                description={
                  controller.loading
                    ? t('serverFiles.states.loading')
                    : t('serverFiles.spaces.empty')
                }
              />
            )}
          </div>

          <div className="server-files-status-bar">
            <span className="server-files-status-info">
              {searchQuery
                ? t('serverFiles.stats.filtered', {
                    count: entries.length,
                    total: rawSortedEntries.length,
                  })
                : t('serverFiles.stats.summary', {
                    total: rawSortedEntries.length,
                    folders: totalFolders,
                    files: totalFiles,
                  })}
            </span>
            {selectedNames.length > 0 && (
              <span className="server-files-status-selected">
                {t('serverFiles.selectionBar.selected', {
                  count: selectedNames.length,
                })}
              </span>
            )}
          </div>
        </Panel>
      </div>

      <Modal
        open={Boolean(nameDialog)}
        title={
          <div className="server-files-dialog-title">
            {nameDialog === 'create' ? <FolderAddOutlined /> : <FormOutlined />}
            <span>
              {t(
                nameDialog === 'create'
                  ? 'serverFiles.create.title'
                  : 'serverFiles.rename.title',
              )}
            </span>
          </div>
        }
        okText={t('common.actions.confirm')}
        cancelText={t('common.actions.cancel')}
        onCancel={() => {
          setNameDialog(undefined);
          setActionTargetEntry(undefined);
        }}
        onOk={() => void submitNameDialog()}
        okButtonProps={{ disabled: !nameValue.trim(), loading: controller.busy }}
        destroyOnHidden
      >
        <div style={{ marginTop: 16 }}>
          <Input
            autoFocus
            value={nameValue}
            maxLength={255}
            prefix={
              nameDialog === 'create' ? (
                <FolderFilled style={{ color: '#38bdf8' }} />
              ) : (
                <FileOutlined style={{ color: '#94a3b8' }} />
              )
            }
            placeholder={t('serverFiles.namePlaceholder')}
            onChange={(event) => setNameValue(event.target.value)}
            onPressEnter={() => void submitNameDialog()}
          />
        </div>
      </Modal>

      <ServerFileDestinationDialog
        open={Boolean(transferDialog)}
        spaces={controller.tree?.spaces ?? []}
        sourcePath={controller.currentPath}
        selectedNames={destinationSelectedNames}
        onCancel={() => {
          setTransferDialog(undefined);
          setActionTargetEntry(undefined);
        }}
        onConfirm={async (path) => {
          const namesToTransfer = destinationSelectedNames;
          const succeeded =
            transferDialog === 'copy'
              ? await controller.copy(path, namesToTransfer)
              : await controller.move(path, namesToTransfer);
          if (succeeded) {
            setTransferDialog(undefined);
            setActionTargetEntry(undefined);
          }
          return succeeded;
        }}
      />

      <ServerFileViewerModal
        entry={viewerEntry}
        initialMode={viewerMode}
        onRead={controller.readFile}
        onSave={(entry, bytes) => controller.upload(entry.name, bytes)}
        onClose={() => setViewerEntry(undefined)}
      />

      <ServerFileUploadDrawer
        open={uploadDrawerOpen}
        targetPathDisplay={'/' + controller.currentPath.slice(1).join('/') || '/'}
        stagedFiles={stagedFiles}
        onStagedFilesChange={setStagedFiles}
        onClose={() => {
          setUploadDrawerOpen(false);
          const allFinished =
            batchItems.length > 0 &&
            batchItems.every((item) =>
              ['completed', 'skipped', 'error', 'canceled'].includes(item.status),
            );
          if (allFinished) {
            setBatchItems([]);
            setBatchSummary(undefined);
            batchManagerRef.current?.destroy();
            batchManagerRef.current = null;
          }
        }}
        onStartUpload={(files) => {
          setStagedFiles([]);
          void uploadStagedFiles(files);
        }}
        isScanning={isScanningDrop}
        uploadItems={batchItems}
        uploadSummary={batchSummary}
        onCancelUploadItem={(id) => batchManagerRef.current?.cancelItem(id)}
        onRetryUploadItem={(id) => batchManagerRef.current?.retryItem(id)}
      />
    </div>
  );
}