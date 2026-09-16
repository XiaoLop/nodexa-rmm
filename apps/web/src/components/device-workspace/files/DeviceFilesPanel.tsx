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
  ReloadOutlined,
  SendOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import type { GatewayClient } from '@meshcentral/control-client';
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
  type TableColumnsType,
} from 'antd';
import { useMemo, useRef, useState } from 'react';
import { fileCommandAvailability, formatFileSize, sortFileEntries } from './fileViewModel';
import { useDeviceFilesSession } from './useDeviceFilesSession';

interface DeviceFilesPanelProps {
  device: Device;
  gatewayClient?: GatewayClient;
  gatewayConnected: boolean;
  filesAllowed?: boolean;
}

type InputDialog = 'mkdir' | 'rename' | 'copy' | 'move' | 'zip' | 'unzip';

function entryIcon(entry: FileEntry) {
  if (entry.kind === 'drive') return <HddOutlined />;
  if (entry.kind === 'directory') return <FolderOutlined />;
  return <FileOutlined />;
}

export function DeviceFilesPanel(props: DeviceFilesPanelProps) {
  const controller = useDeviceFilesSession(props);
  const [modal, modalContextHolder] = Modal.useModal();
  const [dialog, setDialog] = useState<InputDialog>();
  const [dialogValue, setDialogValue] = useState('');
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

  const openDialog = (type: InputDialog) => {
    const selected = controller.selectedEntries[0];
    const currentPath = controller.listing?.path ?? '';
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
      controller.createZip(value.toLocaleLowerCase().endsWith('.zip') ? value : `${value}.zip`);
    if (dialog === 'unzip') controller.extractZip(value);
    setDialog(undefined);
  };

  const confirmRemove = () => {
    const includesDirectory = controller.selectedEntries.some((entry) => entry.kind !== 'file');
    modal.confirm({
      title: includesDirectory ? '递归删除所选目录和文件？' : '删除所选文件？',
      content: includesDirectory
        ? '目录将使用递归语义删除。此操作由远端执行且没有可靠完成回执。'
        : `将删除 ${controller.selectedEntries.length} 个文件。`,
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: controller.removeSelected,
    });
  };

  const columns: TableColumnsType<FileEntry> = [
    {
      title: '名称',
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
      title: '类型',
      dataIndex: 'kind',
      width: 100,
      className: 'device-files-secondary-column',
      render: (kind: FileEntry['kind']) =>
        ({ drive: '磁盘', directory: '文件夹', file: '文件', unknown: '未知' })[kind],
    },
    {
      title: '大小',
      dataIndex: 'size',
      width: 120,
      align: 'right',
      className: 'device-files-size-column',
      render: (size: number | undefined, entry) =>
        entry.kind === 'file' ? formatFileSize(size) : '—',
    },
    {
      title: '修改时间',
      dataIndex: 'modifiedAt',
      width: 180,
      className: 'device-files-time-column',
      render: (value?: Date) => value?.toLocaleString('zh-CN') ?? '—',
    },
    {
      title: '操作',
      key: 'actions',
      width: 64,
      align: 'center',
      render: (_, entry) =>
        entry.kind === 'file' ? (
          <Tooltip title={`下载 ${entry.name}`}>
            <Button
              type="text"
              icon={<DownloadOutlined />}
              aria-label={`下载 ${entry.name}`}
              disabled={disabled}
              onClick={() => void controller.download(entry)}
            />
          </Tooltip>
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
        ? '当前权限明确禁止远程文件访问'
        : controller.status === 'offline'
          ? '设备当前离线，无法建立文件中继'
          : '网关尚未连接';
    return (
      <section className="console-card workspace-tab-empty">
        <Empty description={description} />
      </section>
    );
  }

  return (
    <section
      className="console-card device-files-panel"
      aria-busy={controller.status === 'connecting' || controller.status === 'busy'}
    >
      {modalContextHolder}
      <div className="device-files-toolbar">
        <Space size={4} wrap>
          <Tooltip title="返回上一级">
            <Button
              icon={<ArrowUpOutlined />}
              aria-label="返回上一级"
              disabled={disabled || parent === undefined}
              onClick={() => parent !== undefined && void controller.openDirectory(parent)}
            />
          </Tooltip>
          <Tooltip title="根目录">
            <Button
              icon={<HomeOutlined />}
              aria-label="根目录"
              disabled={disabled || !controller.listing?.path}
              onClick={() => void controller.openDirectory('')}
            />
          </Tooltip>
          <Tooltip title="刷新">
            <Button
              icon={<ReloadOutlined />}
              aria-label="刷新"
              disabled={disabled || !controller.listing}
              onClick={() => void controller.refresh()}
            />
          </Tooltip>
          <Tooltip title="新建目录">
            <Button
              icon={<FolderAddOutlined />}
              aria-label="新建目录"
              disabled={disabled || !controller.listing}
              onClick={() => openDialog('mkdir')}
            />
          </Tooltip>
          <Tooltip title="上传文件">
            <Button
              icon={<UploadOutlined />}
              aria-label="上传文件"
              disabled={disabled || !controller.listing}
              onClick={() => fileInputRef.current?.click()}
            />
          </Tooltip>
          <Tooltip title="下载选中文件">
            <Button
              icon={<DownloadOutlined />}
              aria-label="下载选中文件"
              disabled={disabled || !availability.download}
              onClick={() =>
                controller.selectedEntries[0] &&
                void controller.download(controller.selectedEntries[0])
              }
            />
          </Tooltip>
          <Tooltip title="重命名">
            <Button
              icon={<EditOutlined />}
              aria-label="重命名"
              disabled={disabled || !availability.rename}
              onClick={() => openDialog('rename')}
            />
          </Tooltip>
          <Tooltip title="复制文件">
            <Button
              icon={<CopyOutlined />}
              aria-label="复制文件"
              disabled={disabled || !availability.copy}
              onClick={() => openDialog('copy')}
            />
          </Tooltip>
          <Tooltip title="移动文件">
            <Button
              icon={<SendOutlined />}
              aria-label="移动文件"
              disabled={disabled || !availability.move}
              onClick={() => openDialog('move')}
            />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              danger
              icon={<DeleteOutlined />}
              aria-label="删除"
              disabled={disabled || !availability.remove}
              onClick={confirmRemove}
            />
          </Tooltip>
          <Tooltip title="压缩为 ZIP">
            <Button
              icon={<CompressOutlined />}
              aria-label="压缩为 ZIP"
              disabled={disabled || !availability.zip}
              onClick={() => openDialog('zip')}
            />
          </Tooltip>
          <Tooltip title="解压 ZIP">
            <Button
              icon={<FolderOutlined />}
              aria-label="解压 ZIP"
              disabled={disabled || !availability.unzip}
              onClick={() => openDialog('unzip')}
            />
          </Tooltip>
        </Space>
        <input
          ref={fileInputRef}
          hidden
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void controller.upload(file);
            event.target.value = '';
          }}
        />
      </div>

      <div className="device-files-pathbar">
        <Typography.Text type="secondary">当前位置</Typography.Text>
        <Typography.Text ellipsis={{ tooltip: controller.listing?.path || '根目录' }}>
          {controller.listing?.path || '根目录'}
        </Typography.Text>
      </div>

      {controller.error && (
        <Alert
          type="error"
          showIcon
          message={controller.error}
          action={
            !controller.listing ? (
              <Button size="small" onClick={controller.reconnect}>
                重新连接
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
                description={controller.listing ? '当前目录为空' : '正在读取目录'}
              />
            ),
          }}
          onRow={(entry) => ({
            onDoubleClick: () => {
              if (entry.kind === 'drive' || entry.kind === 'directory')
                void controller.openDirectory(entry.path);
            },
          })}
        />
      </div>

      <div className="device-files-statusbar">
        {controller.activeTransfer ? (
          <>
            <span>
              {controller.activeTransfer.kind === 'upload' ? '正在上传' : '正在下载'}：
              {controller.activeTransfer.name}
            </span>
            <Progress
              percent={Number((controller.activeTransfer.percentage ?? 0).toFixed(1))}
              size="small"
            />
            <Button size="small" danger onClick={controller.cancelTransfer}>
              取消
            </Button>
          </>
        ) : controller.archiveProgress ? (
          <>
            <span title={controller.archiveProgress.file}>
              {controller.archiveProgress.type === 'unzipping'
                ? '正在解压'
                : controller.archiveProgress.type === 'zipping-file'
                  ? `正在压缩：${controller.archiveProgress.file ?? ''}`
                  : '正在准备压缩'}
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
              ? `已选择 ${controller.selectedEntries.length} 项`
              : `${entries.length} 项`}
          </span>
        )}
      </div>

      <Modal
        open={Boolean(dialog)}
        title={
          (
            {
              mkdir: '新建目录',
              rename: '重命名',
              copy: '复制到目录',
              move: '移动到目录',
              zip: '压缩为 ZIP',
              unzip: '解压到目录',
            } as Record<InputDialog, string>
          )[dialog ?? 'mkdir']
        }
        okText="确定"
        cancelText="取消"
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
    </section>
  );
}
