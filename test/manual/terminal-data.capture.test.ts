import { MeshCentralClient } from '@meshcentral/control-client';
import {
  RELAY_PROTOCOLS,
  RelayClient,
  TerminalSession,
  createTerminalOptionsMessage,
  type RelaySession,
} from '@meshcentral/relay';
import { describe, expect, it } from 'vitest';
import {
  CaptureRecorder,
  createGatewayWebSocketFactory,
  createRelayWebSocketFactory,
  environmentNumber,
  controlUrl,
  resemblesRelayLog,
  requiredEnvironment,
  sanitize,
  tunnelRouteResult,
  wait,
  type CaptureScenario,
} from './captureHelpers';

const manual = process.env.RUN_MANUAL_INTEGRATION === '1' ? describe : describe.skip;

manual('manual terminal protocol capture', () => {
  it(
    'captures terminal frames, permission rejection, or relaylog events',
    async () => {
      const scenario = requiredEnvironment('CAPTURE_SCENARIO') as CaptureScenario;
      if (!['terminal', 'permission-denied', 'relaylog'].includes(scenario)) {
        throw new Error('CAPTURE_SCENARIO must be terminal, permission-denied, or relaylog.');
      }

      const recorder = new CaptureRecorder();
      const controller = new AbortController();
      let routeFailure: string | undefined;
      const acceptedTunnelResponses = new Set<string>();
      const gateway = new MeshCentralClient({
        url: controlUrl(),
        getAccessToken: () => process.env.GATEWAY_ACCESS_TOKEN?.trim() || undefined,
        webSocketFactory: createGatewayWebSocketFactory(recorder),
        connectionTimeoutMs: environmentNumber('MANUAL_CONNECTION_TIMEOUT_MS', 15_000),
        reconnectDelaysMs: [],
      });
      const removeMessage = gateway.on('message', (message) => {
        if (scenario === 'permission-denied' || resemblesRelayLog(message)) {
          recorder.add({ channel: 'event', kind: 'gateway-message', data: sanitize(message) });
        }
        const route = tunnelRouteResult(message);
        if (route) {
          if (!route.failed && route.responseId) acceptedTunnelResponses.add(route.responseId);
          if (route.failed) {
            routeFailure = route.result;
            const previouslyAccepted = Boolean(
              route.responseId && acceptedTunnelResponses.has(route.responseId),
            );
            recorder.add({
              channel: 'result',
              kind: previouslyAccepted ? 'tunnel-route-conflict' : 'tunnel-route-failure',
              data: { result: route.result, previouslyAccepted },
            });
            if (!previouslyAccepted) {
              controller.abort();
            }
          }
        }
      });
      const removeEvent = gateway.on('event', (event) => {
        if (event.type === 'relayLog' || resemblesRelayLog(event.raw)) {
          recorder.add({ channel: 'event', kind: 'relay-event', data: sanitize(event) });
        }
      });
      const removeDiagnostic = gateway.on('diagnostic', (diagnostic) => {
        recorder.add({ channel: 'result', kind: 'gateway-diagnostic', data: sanitize(diagnostic) });
      });
      const removeError = gateway.on('error', (error) => {
        recorder.add({ channel: 'result', kind: 'gateway-error', data: { name: error.name, message: error.message } });
      });

      let relay: RelaySession | undefined;
      let terminal: TerminalSession | undefined;
      try {
        await gateway.connect();
        recorder.add({ channel: 'result', kind: 'gateway-connected' });
        const deviceId = requiredEnvironment(
          scenario === 'permission-denied' ? 'MESH_DENIED_DEVICE_ID' : 'MESH_DEVICE_ID',
        );
        const devices = await gateway.devices.list();
        const device = devices.find((item) => item.id === deviceId);
        recorder.add({
          channel: 'result',
          kind: 'device-preflight',
          data: {
            found: Boolean(device),
            online: device?.online ?? false,
            platform: device?.platform,
            agentVersion: device?.agentVersion,
          },
        });
        if (!device) throw new Error('Target device is not visible to the current gateway account.');
        if (!device.online) throw new Error('Target device is offline and cannot route a terminal tunnel.');
        const initialSize = {
          cols: environmentNumber('TERMINAL_COLS', 120),
          rows: environmentNumber('TERMINAL_ROWS', 30),
        };
        let recorded = false;
        const relayClient = new RelayClient({
          baseUrl: requiredEnvironment('MESHRELAY_URL'),
          control: gateway,
          webSocketFactory: createRelayWebSocketFactory(recorder),
        });
        try {
          relay = await relayClient.createSession({
            deviceId,
            protocol: RELAY_PROTOCOLS.terminal,
            signal: controller.signal,
            authorizationTimeoutMs: environmentNumber('MANUAL_CONNECTION_TIMEOUT_MS', 15_000),
            connectionTimeoutMs: environmentNumber('MANUAL_CONNECTION_TIMEOUT_MS', 15_000),
            handshakeTimeoutMs: environmentNumber('MANUAL_HANDSHAKE_TIMEOUT_MS', 15_000),
            onStateChange: (change) => recorder.add({ channel: 'result', kind: 'relay-state', data: sanitize(change) }),
            onHandshakeMessage: (message) => {
              recorded = message === 'cr';
              recorder.add({ channel: 'result', kind: 'relay-handshake', data: { message, recorded } });
            },
            onError: (error) => recorder.add({ channel: 'result', kind: 'relay-error', data: { name: error.name, message: error.message } }),
            onClose: (event) => recorder.add({ channel: 'result', kind: 'relay-close', data: sanitize(event) }),
            createStartupMessages: () => [
              createTerminalOptionsMessage(1, initialSize),
              '1',
            ],
          });
          terminal = new TerminalSession(relay, {
            initialSize,
            recorded,
            rttIntervalMs: environmentNumber('MANUAL_RTT_INTERVAL_MS', 10_000),
            onControlMessage: (message) =>
              recorder.add({ channel: 'relay', kind: 'terminal-control', data: sanitize(message) }),
          });
          terminal.onData((data) => {
            recorder.add({
              channel: 'relay',
              direction: 'server-to-client',
              kind: 'terminal-output',
              data: { frameType: typeof data === 'string' ? 'text' : 'binary', byteLength: typeof data === 'string' ? new TextEncoder().encode(data).byteLength : data.byteLength },
            });
          });
          terminal.onLatencyChange((latencyMs) => recorder.add({ channel: 'result', kind: 'latency', data: { latencyMs } }));
          recorder.add({ channel: 'result', kind: 'terminal-ready', data: { recorded, initialSize } });

          const input = process.env.MANUAL_TERMINAL_INPUT;
          if (input) {
            terminal.write(input.replace(/\\r/g, '\r').replace(/\\n/g, '\n'));
            recorder.add({ channel: 'result', kind: 'test-input-sent', data: { byteLength: new TextEncoder().encode(input).byteLength } });
          }
          await wait(environmentNumber('MANUAL_EVENT_WINDOW_MS', 10_000));
          if (scenario === 'permission-denied') {
            recorder.add({ channel: 'result', kind: 'unexpected-permission-success' });
          }
        } catch (error) {
          recorder.add({
            channel: 'result',
            kind: routeFailure
              ? 'tunnel-route-rejected'
              : scenario === 'permission-denied'
                ? 'permission-denied-result'
                : 'terminal-failure',
            data: routeFailure
              ? { result: routeFailure }
              : error instanceof Error
                ? { name: error.name, message: error.message }
                : sanitize(error),
          });
          if (scenario !== 'permission-denied') {
            if (routeFailure) {
              throw new Error(`Tunnel routing failed: ${routeFailure}`, { cause: error });
            }
            throw error;
          }
        } finally {
          terminal?.close(1000, 'Manual terminal capture completed.');
          if (!terminal) relay?.close(1000, 'Manual relay capture completed.');
        }

        if (scenario === 'relaylog') {
          await wait(environmentNumber('MANUAL_RELAYLOG_WAIT_MS', 5_000));
          const events = await gateway.events.listByDevice(requiredEnvironment('MESH_DEVICE_ID'), {
            limit: 100,
          });
          for (const event of events) {
            if (event.type === 'relayLog' || resemblesRelayLog(event.raw)) {
              recorder.add({ channel: 'event', kind: 'relay-history', data: sanitize(event) });
            }
          }
        }
      } finally {
        controller.abort();
        removeMessage();
        removeEvent();
        removeDiagnostic();
        removeError();
        gateway.destroy();
        const path = await recorder.write(scenario);
        console.info(`Sanitized capture written to ${path}`);
      }

      expect(recorder.entries.length).toBeGreaterThan(0);
    },
    environmentNumber('MANUAL_TEST_TIMEOUT_MS', 60_000),
  );
});