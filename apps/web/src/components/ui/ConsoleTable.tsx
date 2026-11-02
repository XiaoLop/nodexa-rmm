import { Table, type TableProps } from 'antd';

/** Consistent density and pagination; callers retain control of data and actions. */
export function ConsoleTable<RecordType extends object>({
  className,
  pagination,
  size = 'middle',
  ...props
}: TableProps<RecordType>) {
  return (
    <Table<RecordType>
      {...props}
      size={size}
      className={['console-table', className].filter(Boolean).join(' ')}
      pagination={
        pagination === false
          ? false
          : {
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100],
              hideOnSinglePage: true,
              ...pagination,
            }
      }
    />
  );
}
