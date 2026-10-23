import { devicesGetTool } from './devices-get';
import { devicesListTool } from './devices-list';
import { eventsQueryTool } from './events-query';
import { groupsListTool } from './groups-list';
import { serverStatusTool } from './server-status';
import type { ToolDefinition } from './tool-definition';

export const READ_ONLY_TOOLS: readonly ToolDefinition[] = [
  devicesListTool,
  devicesGetTool,
  groupsListTool,
  eventsQueryTool,
  serverStatusTool,
];

export { devicesGetTool, devicesListTool, eventsQueryTool, groupsListTool, serverStatusTool };
export * from './tool-definition';
