export type MeshCentralCommand = Record<string, unknown> & {
  action?: string;
  plugin?: string;
  subAction?: string;
  userid?: string;
};

export interface MeshCentralConnection {
  send(message: Record<string, unknown> | string): void;
}

export interface MeshCentralUser {
  _id?: string;
  name?: string;
  domain?: string;
  siteadmin?: number;
  [key: string]: unknown;
}

export interface MeshCentralDatabase {
  Get?(id: string, callback: (error: unknown, documents: unknown[]) => void): void;
  Set?(document: Record<string, unknown>): void;
  Remove?(id: string, callback?: (error?: unknown) => void): void;
  [key: string]: unknown;
}

export interface MeshCentralServer {
  config?: Record<string, unknown>;
  datapath?: string;
  db?: MeshCentralDatabase;
  DispatchEvent?(
    targets: string[],
    source: unknown,
    event: Record<string, unknown>,
  ): void;
  debug?(category: string, message: string): void;
  [key: string]: unknown;
}

export interface MeshCentralHttpApplication {
  get(path: string, ...handlers: unknown[]): unknown;
  post(path: string, ...handlers: unknown[]): unknown;
  put(path: string, ...handlers: unknown[]): unknown;
  delete(path: string, ...handlers: unknown[]): unknown;
  use(...handlers: unknown[]): unknown;
}

export interface MeshCentralWebServer {
  app: MeshCentralHttpApplication;
  bodyParser?: {
    json(...args: unknown[]): unknown;
    urlencoded(...args: unknown[]): unknown;
  };
  setSessionRandom?(request: unknown): void;
  [key: string]: unknown;
}

export interface MeshCentralAgentConnection extends MeshCentralConnection {
  dbMeshKey?: string;
  dbNodeKey?: string;
  remoteaddrport?: string;
  [key: string]: unknown;
}

export interface MeshCentralAgentServer {
  parent?: MeshCentralServer;
  [key: string]: unknown;
}

export interface MeshCentralUserServer {
  parent?: MeshCentralServer;
  [key: string]: unknown;
}

export type MeshCentralServerActionContext =
  | MeshCentralAgentServer
  | MeshCentralUserServer;

export interface MeshCentralPluginTabRegistration {
  tabId: string;
  tabTitle: string;
}

export interface MeshCentralPluginHandler {
  parent: MeshCentralServer;
  pluginPath: string;
  plugins: Record<string, MeshCentralPlugin>;
  exports: Record<string, string[]>;
  loadList: string[];
  callHook(hookName: string, ...args: unknown[]): void;
  addMeshCoreModules(modules: Record<string, string[]>): void;
  deviceViewPanel(): Record<
    string,
    { header: string; content: string }
  >;
}

export interface MeshCentralPlugin {
  exports: string[];
  server_startup?: () => void;
  hook_setupHttpHandlers?: (
    webServer: MeshCentralWebServer,
    meshServer: MeshCentralServer,
  ) => void;
  hook_userLoggedIn?: (user: MeshCentralUser) => void;
  hook_agentCoreIsStable?: (
    agent: MeshCentralAgentConnection,
    agentServer: MeshCentralAgentServer,
  ) => void;
  hook_processAgentData?: (
    command: MeshCentralCommand,
    agent: MeshCentralAgentConnection,
    agentServer: MeshCentralAgentServer,
  ) => void;
  serveraction?: (
    command: MeshCentralCommand,
    connection: MeshCentralConnection,
    server: MeshCentralServerActionContext,
  ) => void;
  uiCustomEvent?: (
    command: MeshCentralCommand,
    connection: MeshCentralConnection,
  ) => void;
  on_device_header?: () => string;
  on_device_page?: () => string;
  onWebUIStartupEnd?: () => void;
  onDeviceRefreshEnd?: (...args: unknown[]) => void;
  [method: string]: unknown;
}

export type MeshCentralPluginFactory = (
  pluginHandler: MeshCentralPluginHandler,
) => MeshCentralPlugin;