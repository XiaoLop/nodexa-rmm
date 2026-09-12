# Terminal protocol fixtures

These fixtures contain only protocol facts confirmed against the target Windows CMD session on 2026-09-12. Identifiers, cookies, addresses, terminal text, command history, and relay session identifiers are intentionally omitted.

The diagnostic capture stored only binary frame lengths, not raw bytes. Therefore this directory does not fabricate `binary-input.bin` or `binary-output.bin`. Raw binary fixtures should be added only after a capture run sends a predefined non-sensitive payload and explicitly records those bytes.

Unconfirmed `cr`, `termsize`, `ping`, `pong`, `metadata`, `disconnect`, permission-denied, PowerShell, Linux, and macOS fixtures are intentionally absent.