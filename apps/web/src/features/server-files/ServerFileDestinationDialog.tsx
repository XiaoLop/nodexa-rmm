import type { ServerFileEntry, ServerFileSpace } from '@meshcentral/control-client';
import { FolderFilled, TeamOutlined, UserOutlined } from '@ant-design/icons';
import { Alert, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConsoleModal } from '../../components/ui/ConsoleModal';
import { hasServerFileNameConflict } from './serverFileViewModel';

interface ServerFileDestinationDialogProps {
  open: boolean;
  spaces: readonly ServerFileSpace[];
  sourcePath: readonly string[];
  selectedNames: readonly string[];
  onCancel: () => void;
  onConfirm: (path: string[]) => Promise<boolean> | boolean;
}

function directoryNodes(entries: readonly ServerFileEntry[]): DataNode[] {
  return entries
    .filter((entry) => entry.kind === 'directory')
    .map((entry) => ({
      key: entry.path.join('\u0000'),
      title: entry.name,
      icon: <FolderFilled style={{ color: '#38bdf8' }} />,
      children: directoryNodes(entry.children ?? []),
    }));
}

export function ServerFileDestinationDialog({
  open,
  spaces,
  sourcePath,
  selectedNames,
  onCancel,
  onConfirm,
}: ServerFileDestinationDialogProps) {
  const { t } = useTranslation();
  const [selectedKey, setSelectedKey] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const treeData = useMemo<DataNode[]>(
    () =>
      spaces.map((space) => ({
        key: space.id,
        title: space.name,
        icon:
          space.kind === 'user' ? (
            <UserOutlined style={{ color: '#3b82f6' }} />
          ) : (
            <TeamOutlined style={{ color: '#a855f7' }} />
          ),
        children: directoryNodes(space.entries),
      })),
    [spaces],
  );
  const selectedPath = selectedKey?.split('\u0000');
  const destinationSpace = spaces.find((space) => space.id === selectedPath?.[0]);
  const sameDirectory = selectedKey === sourcePath.join('\u0000');
  const hasConflict = Boolean(
    selectedPath && hasServerFileNameConflict(destinationSpace, selectedPath, selectedNames),
  );

  return (
    <ConsoleModal
      open={open}
      title={t('serverFiles.destination.title')}
      okText={t('serverFiles.destination.confirm')}
      cancelText={t('common.actions.cancel')}
      okButtonProps={{
        disabled: !selectedKey || sameDirectory || hasConflict,
        loading: submitting,
      }}
      onCancel={onCancel}
      onOk={async () => {
        if (!selectedKey) return;
        setSubmitting(true);
        try {
          const succeeded = await onConfirm(selectedKey.split('\u0000'));
          if (succeeded) setSelectedKey(undefined);
        } finally {
          setSubmitting(false);
        }
      }}
      destroyOnHidden
    >
      <Alert
        type="info"
        showIcon
        title={t('serverFiles.destination.selection', { count: selectedNames.length })}
      />
      {(sameDirectory || hasConflict) && (
        <Alert
          type="warning"
          showIcon
          title={t(
            sameDirectory
              ? 'serverFiles.destination.sameDirectory'
              : 'serverFiles.destination.nameConflict',
          )}
          className="server-files-destination-warning"
        />
      )}
      <Tree
        showIcon
        blockNode
        defaultExpandAll
        treeData={treeData}
        selectedKeys={selectedKey ? [selectedKey] : []}
        onSelect={(keys) => setSelectedKey(keys[0] ? String(keys[0]) : undefined)}
        className="server-files-destination-tree"
      />
    </ConsoleModal>
  );
}
