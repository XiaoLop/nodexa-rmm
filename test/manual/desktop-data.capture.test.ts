import { GatewayClient } from '@meshcentral/control-client';
import { RELAY_PROTOCOLS, RelayClient, type RelaySession } from '@meshcentral/relay';
import { describe, expect, it } from 'vitest';
import { DesktopProtocolParser, parseScreenSize, parseTile } from '../desktop/protocolParser';
import {
  environmentNumber,
  gatewayUrl,
  requiredEnvironment,
  wait,
} from './captureHelpers';
import {
  createDesktopGatewayWebSocketFactory,
  createDesktopRelayWebSocketFactory,
  DesktopCaptureRecorder,
} from './desktopCaptureHelpers';
import {
  isActionScenario,
  parseDesktopCaptureScenario,
  scenarioMessages,
} from './desktopCaptureScenarios';

const manual = process.env.RUN_MANUAL_INTEGRATION === '1' ? describe : describe.skip;

manual('manual desktop protocol capture', () => {
  it('captures a scenario without interpreting unverified protocol fields as stable API', async () => {
    const scenario = parseDesktopCaptureScenario(requiredEnvironment('DESKTOP_CAPTURE_SCENARIO'));
    const expectedActions = isActionScenario(scenario) ? [scenario] : [];
    const recorder = new DesktopCaptureRecorder({
      schemaVersion: 1,
      caseId: scenario,
      scenario: scenario.split('-')[0] || scenario,
      protocol: 2,
      transport: 'websocket',
      expectedActions,
      expectedObservations: ['relay-handshake', 'screen-size', 'desktop-ready'],
      observations: {},
    });
    await recorder.prepare(true);

    const controller = new AbortController();
    const parser = new DesktopProtocolParser();
    const readyAfterTiles = environmentNumber('DESKTOP_READY_AFTER_TILES', 0);
    let screenKnown = false;
    let tileCount = 0;
    let relay: RelaySession | undefined;
    const gateway = new GatewayClient({
      url: gatewayUrl(),
      getAccessToken: () => process.env.GATEWAY_ACCESS_TOKEN?.trim() || undefined,
      webSocketFactory: createDesktopGatewayWebSocketFactory(recorder),
      connectionTimeoutMs: environmentNumber('MANUAL_CONNECTION_TIMEOUT_MS', 15_000),
      reconnectDelaysMs: [],
    });

    try {
      await gateway.connect();
      const deviceId = requiredEnvironment('MESH_DEVICE_ID');
      const device = (await gateway.devices.list()).find((item) => item.id === deviceId);
      if (!device) throw new Error('Target device is not visible to the current gateway account.');
      if (!device.online) throw new Error('Target device is offline and cannot route a desktop tunnel.');

      const relayClient = new RelayClient({
        baseUrl: requiredEnvironment('MESHRELAY_URL'),
        control: gateway,
        webSocketFactory: createDesktopRelayWebSocketFactory(recorder),
      });
      relay = await relayClient.createSession({
        deviceId,
        protocol: RELAY_PROTOCOLS.desktop,
        usage: 2,
        signal: controller.signal,
        authorizationTimeoutMs: environmentNumber('MANUAL_CONNECTION_TIMEOUT_MS', 15_000),
        connectionTimeoutMs: environmentNumber('MANUAL_CONNECTION_TIMEOUT_MS', 15_000),
        handshakeTimeoutMs: environmentNumber('MANUAL_HANDSHAKE_TIMEOUT_MS', 15_000),
        createStartupMessages: () => ['2'],
        onHandshakeMessage: (message) => {
          recorder.manifest.observations = {
            ...recorder.manifest.observations,
            relayHandshake: message,
            relayRecorded: message === 'cr',
          };
        },
        onRawMessage: (data) => {
          if (!(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) return;
          const bytes = data instanceof ArrayBuffer
            ? new Uint8Array(data)
            : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          for (const command of parser.push(bytes)) {
            if (command.command === 7) {
              screenKnown = true;
              recorder.manifest.observations = {
                ...recorder.manifest.observations,
                screenSize: parseScreenSize(command),
              };
            }
            if (command.command === 3) {
              tileCount += 1;
              const tile = parseTile(command);
              recorder.manifest.observations = {
                ...recorder.manifest.observations,
                tileCount,
                lastTile: { x: tile.x, y: tile.y, imageFormat: tile.imageFormat },
                desktopReady: readyAfterTiles > 0 && tileCount >= readyAfterTiles,
              };
            }
          }
        },
      });

      await wait(environmentNumber('DESKTOP_ACTION_DELAY_MS', 2_000));
      const messages = scenarioMessages(scenario);
      if (messages.length > 0) {
        const action = recorder.startAction(`${scenario}-01`, scenario, {
          desktopX: environmentNumber('DESKTOP_ACTION_X', 320),
          desktopY: environmentNumber('DESKTOP_ACTION_Y', 240),
        });
        const firstMessageSeq = recorder.lastMessageSeq + 1;
        for (const message of messages) relay.sendBinary(message);
        recorder.linkAction(action, firstMessageSeq, recorder.lastMessageSeq);
      }
      await wait(environmentNumber('MANUAL_EVENT_WINDOW_MS', 10_000));
    } finally {
      relay?.close(1000, 'Manual desktop capture completed.');
      controller.abort();
      gateway.destroy();
      recorder.manifest.observations = {
        ...recorder.manifest.observations,
        screenKnown,
        tileCount,
        pendingProtocolBytes: parser.pendingByteLength,
      };
      const path = await recorder.write();
      console.info(`Sanitized desktop capture written to ${path}`);
    }

    expect(recorder.lastMessageSeq).toBeGreaterThan(0);
  }, environmentNumber('MANUAL_TEST_TIMEOUT_MS', 60_000));
});