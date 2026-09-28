export const enUS = {
  "common": {
    "language": "Language",
    "simplifiedChinese": "简体中文",
    "english": "English",
    "loadingSession": "Restoring secure session…",
    "noAccess": "Access denied",
    "noAccessDescription": "Your account does not have permission to access this page.",
    "status": {
      "online": "Online",
      "offline": "Offline",
      "connected": "Connected",
      "connecting": "Connecting",
      "reconnecting": "Reconnecting",
      "disconnected": "Disconnected",
      "unavailable": "Unavailable",
      "now": "Now",
      "notConfigured": "Not configured",
      "configured": "Configured gateway",
      "systemEvent": "System event",
      "unknown": "Unknown",
      "ungrouped": "Ungrouped",
      "defaultGroup": "Default group"
    },
    "actions": {
      "backToDashboard": "Back to dashboard",
      "backToOverview": "Back to overview",
      "viewAll": "View all",
      "reconnect": "Reconnect",
      "cancel": "Cancel",
      "rename": "Rename",
      "confirm": "Confirm",
      "delete": "Delete",
      "edit": "Edit",
      "save": "Save changes",
      "create": "Create",
      "refresh": "Refresh",
      "copy": "Copy",
      "copied": "Copied",
      "download": "Download",
      "retry": "Retry",
      "details": "Details",
      "view": "View",
      "enable": "Enable",
      "disable": "Disable"
    }
  },
  "deviceWorkspace": {
    "ariaLabel": "Device workspace functions",
    "loading": "Loading device workspace",
    "loadingAnnouncement": "Connecting to the gateway and loading device information...",
    "loadFailed": "Failed to load device details",
    "notFound": "Device not found",
    "backToList": "Back to device list",
    "partialRefreshFailed": "Failed to refresh partial device data",
    "duration": { "years": "{{count}} year(s)", "months": "{{count}} month(s)", "days": "{{count}} day(s)", "hours": "{{count}} hour(s)", "minutes": "{{count}} minute(s)" },
    "tabs": { "overview": "Overview", "desktop": "Remote desktop", "terminal": "Terminal", "files": "Files", "processes": "Processes", "services": "Services", "logs": "Logs" },
    "header": { "pendingReboot": "Restart required", "cpu": "Processor", "systemHardware": "System hardware", "memory": "Physical memory", "slots": "{{count}} slots", "systemMemory": "System memory", "storage": "Storage", "remaining": "{{value}} remaining", "localDisk": "Local disk", "display": "Graphics/display", "standardDisplay": "Standard display", "uptime": "Uptime", "hours": "{{value}} hours", "source": "Source {{value}}", "heartbeat": "Heartbeat {{value}}", "connectable": "Connectable", "unavailable": "Unavailable" },
    "overview": { "status": { "unknown": "Not checked", "healthy": "Healthy", "warning": "Warning", "danger": "Abnormal or stopped" }, "cpu": "Processor (CPU)", "frequency": "Frequency {{value}}", "memory": "Physical memory", "slots": "{{count}} slots", "storage": "Local storage", "available": "{{value}} available", "volumes": "{{count}} volumes", "network": "Primary network adapter", "interfaces": "{{count}} active interfaces", "healthTitle": "Device health and security", "securityDescription": "System baseline and Windows Security Center checks", "connectionDescription": "Device and gateway connection status", "pendingReboot": "System notice: restart required for {{value}}. Consider restarting the device.", "deviceSignal": "Device signaling", "connected": "Connected", "gateway": "Gateway", "gatewayOffline": "Gateway offline", "antivirus": "Virus protection", "firewall": "System firewall", "updates": "Automatic updates", "realtimeProtection": "Real-time protection", "volumesTitle": "Disk volume storage", "volumesDescription": "Logical partitions and remaining capacity", "volumeCount": "{{count}} volumes", "usedPercent": "{{value}}% used", "totalCapacity": "Total capacity", "remaining": "Available", "profileTitle": "System and hardware", "profileDescription": "Device identity and low-level components", "fields": { "hostname": "Hostname", "platform": "Operating system", "cpu": "Processor", "gpu": "Graphics device", "board": "Board / BIOS", "currentUser": "Current user", "uptime": "Uptime", "agent": "Agent core", "ipv4": "IPv4 address", "mac": "Physical MAC", "primaryNic": "Primary network interface", "dns": "DNS servers", "remoteSource": "Remote source", "lastConnection": "Last connection" }, "adminMode": "administrator mode", "activityTitle": "Recent device activity", "activityDescription": "Realtime gateway events for this device", "viewLogs": "View logs", "noActivity": "No device activity", "networkTitle": "Network configuration and connection audit", "networkDescription": "Interface details and last connection source" },
    "settings": { "remoteControl": "Remote control", "keyboard": "Enable keyboard input", "mouse": "Enable mouse control", "screenInput": "Screen user input", "display": "Display settings", "resolution": "Resolution", "colorDepth": "Color depth", "bits": "{{value}} bit", "quality": "Quality", "smooth": "Smooth", "medium": "Medium", "high": "High definition", "latency": "Connection latency", "latencyTrend": "Connection latency trend", "timeout": "Response timed out", "waiting": "Waiting for response", "rtt": "Live RTT", "sessionActions": "Session actions", "endSessionTitle": "End the current session?", "endSessionContent": "The remote desktop connection will close immediately.", "confirmEnd": "End session", "endSession": "End session" },
    "remoteDesktop": { "status": { "idle": "Not connected", "authorizing": "Requesting relay authorization", "notifying": "Notifying the device agent", "connecting": "Connecting to relay", "handshaking": "Waiting for desktop pairing", "waitingScreen": "Waiting for desktop screen", "connected": "Connected", "closed": "Session ended", "error": "Connection failed" }, "errors": { "agentRoute": "The device agent cannot establish a desktop channel right now. Try again later.", "cancelled": "Desktop connection cancelled.", "relay": "Remote desktop relay connection failed." }, "gatewayDisconnected": "The gateway connection was lost and the desktop session ended.", "qualityUpdateFailed": "Failed to update remote desktop quality.", "permissionDenied": "The current account does not have remote desktop permission.", "deviceOffline": "The device is offline and cannot establish remote desktop.", "gatewayUnavailable": "The gateway control channel is unavailable.", "localClipboardEmpty": "The local clipboard is empty.", "sessionClosed": "The remote desktop session has ended.", "clipboardSubmitted": "Clipboard content submitted and remote Ctrl+V triggered.", "pasteFailed": "Failed to paste to the remote device.", "clipboardCopied": "Copied {{count}} characters from the remote clipboard to the local clipboard.", "clipboardSyncFailed": "Failed to sync the remote clipboard.", "clipboardErrors": { "missingText": "The remote clipboard response did not contain text.", "timeout": "The remote clipboard did not respond. It may be empty, unavailable, or unsupported by the agent.", "sendFailed": "The remote clipboard request could not be sent." }, "fullscreen": "Fullscreen", "exitFullscreen": "Exit fullscreen", "screenshot": "Screenshot", "endSession": "End session", "pasteRemote": "Paste to remote", "copyLocal": "Copy to local", "connecting": "Connecting", "connect": "Connect desktop", "viewOnly": "View only", "limitedInput": "Limited input", "accessPending": "Permission pending server confirmation", "recorded": "Recorded", "fitWindow": "Fit window", "unavailable": "Remote desktop session cannot be established", "establishing": "Establishing a new desktop session", "connectToView": "Connect to view the remote desktop", "pasteTitle": "Paste local clipboard to the remote device?", "manualPaste": "The browser cannot read the clipboard automatically. Paste the content below.", "pastePlaceholder": "Paste local clipboard content here", "pasteSummary": "Submit {{count}} characters to {{hostname}}." },
    "systemManagement": { "errors": { "parse": "The data returned by the device could not be parsed.", "disconnected": "The gateway connection was lost. Restore the connection and try again.", "timeout": "The device response timed out. Confirm that the device is online and try again.", "send": "The request could not be sent." }, "deviceOffline": "The device is offline and its data cannot be read.", "gatewayDisconnected": "The gateway connection was lost and device data cannot be read.", "loadFailed": "Failed to load data", "processColumns": { "name": "Process name", "user": "User", "path": "Executable path" }, "processTitle": "Process management", "processDescription": "View running processes, their users, and executable locations.", "processSearchAria": "Search processes", "processSearchPlaceholder": "Search by name, PID, user, or path", "processCount": "Total processes", "userCount": "Users", "currentResults": "Current results", "lastUpdated": "Last updated", "notUpdated": "Not updated", "emptyOffline": "Device offline", "emptyProcesses": "No matching processes", "waitingGateway": "Waiting for gateway connection", "serviceStates": { "RUNNING": "Running", "STOPPED": "Stopped", "PAUSED": "Paused", "START_PENDING": "Starting", "STOP_PENDING": "Stopping", "CONTINUE_PENDING": "Continuing", "PAUSE_PENDING": "Pausing", "UNKNOWN": "Unknown" }, "allStates": "All states", "serviceColumns": { "name": "Service name", "displayName": "Display name", "status": "Status", "controls": "Accepted controls" }, "serviceTitle": "System services", "serviceDescription": "View service status, related processes, and controls reported by the agent.", "serviceSearchAria": "Search services", "serviceSearchPlaceholder": "Search by service name, display name, or PID", "serviceFilterAria": "Service status", "serviceCount": "Total services", "runningCount": "Running", "stoppedCount": "Stopped", "emptyServices": "No matching services" },
    "files": { "errors": { "connection-lost": "The file relay connection was lost.", "not-found": "The requested file or directory was not found.", "permission-denied": "You do not have permission to perform this file operation.", "timed-out": "The file operation timed out.", "protocol": "The file relay returned unrecognized data.", "read-directory": "Failed to read the directory.", "operation": "The file operation could not be sent.", "upload": "File upload failed.", "download": "File download failed.", "archive": "The archive request could not be sent." }, "deleteSelectionTitle": "Recursively delete the selected directories and files?", "deleteFilesTitle": "Delete the selected files?", "deleteDirectoryContent": "Directories will be deleted recursively. This runs remotely and has no reliable completion acknowledgement.", "deleteFilesContent": "{{count}} files will be deleted.", "columns": { "name": "Name", "type": "Type", "size": "Size", "modified": "Modified", "actions": "Actions" }, "types": { "drive": "Drive", "directory": "Folder", "file": "File", "unknown": "Unknown" }, "downloadEntry": "Download {{name}}", "forbidden": "Remote file access is explicitly denied for this account", "offline": "The device is offline and cannot establish a file relay", "disconnected": "The gateway is not connected", "up": "Go up", "root": "Root", "newDirectory": "New folder", "upload": "Upload file", "downloadSelected": "Download selected files", "copy": "Copy files", "move": "Move files", "zip": "Create ZIP", "unzip": "Extract ZIP", "currentPath": "Current location", "emptyDirectory": "This directory is empty", "readingDirectory": "Reading directory", "uploading": "Uploading", "downloading": "Downloading", "unzipping": "Extracting", "zippingFile": "Creating archive: {{file}}", "preparingZip": "Preparing archive", "selectedCount": "{{count}} selected", "entryCount": "{{count}} items", "dialogs": { "mkdir": "New folder", "rename": "Rename", "copy": "Copy to folder", "move": "Move to folder", "zip": "Create ZIP", "unzip": "Extract to folder" } },
    "terminal": { "status": { "idle": "Not connected", "authorizing": "Requesting relay authorization", "notifying": "Notifying the device agent", "connecting": "Connecting to relay", "handshaking": "Waiting for terminal pairing", "ready": "Connected", "closed": "Session ended", "error": "Connection failed" }, "errors": { "agentRoute": "The device agent cannot establish a terminal channel right now. Try again later.", "cancelled": "Terminal connection cancelled.", "relay": "Terminal relay connection failed." }, "gatewayDisconnected": "The gateway connection was lost and the terminal session ended.", "permissionDenied": "The current account does not have terminal permission for this device.", "deviceOffline": "The device is offline and cannot establish a terminal relay.", "gatewayUnavailable": "The gateway control channel is unavailable.", "sessionEstablished": "A new terminal session has been established.", "clipboardReadFailed": "Could not read the clipboard. Confirm that the page uses HTTPS and has permission.", "selectTextFirst": "Select text in the terminal first.", "selectionCopied": "Terminal selection copied.", "clipboardWriteFailed": "Could not write to the clipboard.", "cancelConnection": "Cancel connection", "connect": "Connect terminal", "disconnect": "Disconnect", "searchBuffer": "Search buffer", "copySelection": "Copy selection", "paste": "Paste", "clear": "Clear local display", "fullscreen": "Fullscreen", "searchPlaceholder": "Search terminal output", "recordedNotice": "This session is being recorded by the server", "unavailable": "Terminal is currently unavailable", "noPermission": "The current account has no terminal permission", "deviceOfflineShort": "Device offline", "gatewayDisconnectedShort": "Gateway disconnected", "cancelHint": "You can cancel this connection", "interactiveHint": "Connect to start an interactive Shell session", "latencyUnknown": "Latency —", "latency": "Latency {{value}} ms", "sessionDuration": "Session {{value}}", "confirmPasteTitle": "Confirm paste to remote terminal", "confirmPaste": "Confirm paste", "confirmPasteDescription": "This content contains multiple lines, control characters, or a long text. It will be sent directly to the remote Shell.", "pasteMeta": "{{characters}} characters, {{lines}} lines", "ariaLabel": "Remote terminal" },
    "logs": {
      "filters": { "all": "All types", "agentlog": "Agent log", "relaylog": "Relay log", "manual": "Manual operation", "runcommands": "Command execution", "batchupload": "Batch upload", "changenode": "Device changed", "removenode": "Device removed" },
      "types": { "deviceOnline": "Device online", "deviceOffline": "Device offline", "deviceChanged": "Device changed", "deviceRemoved": "Device removed", "relayLog": "Relay log", "agentLog": "Agent log", "manualOperation": "Manual operation", "commandExecution": "Command execution", "batchUpload": "Batch upload", "userSessionCount": "Session stats", "unknown": "Other event" },
      "queryFailed": "Failed to query device logs.", "columns": { "time": "Time", "type": "Type", "user": "User", "ip": "Source IP", "content": "Log content", "actions": "Actions" }, "title": "Device log monitor", "description": "Historical records are merged with events pushed through the current connection.", "live": "Live monitoring", "searchAria": "Search device logs", "searchPlaceholder": "Search content, user or IP", "filterAria": "Log type", "limitAria": "Log count", "countOption": "{{count}} items", "disconnectedNotice": "Gateway disconnected. Logs may not be up to date.", "loadFailed": "Failed to load device logs", "waitingConnection": "Waiting for gateway connection", "empty": "No matching device logs", "drawer": { "title": "Device log details", "action": "Action", "rawTitle": "Sanitized raw data" }
    }
  },
  "navigation": {
    "dashboard": "Dashboard",
    "overview": "Overview",
    "deviceManagement": "Device management",
    "allDevices": "All devices",
    "deviceGroups": "Device groups",
    "monitoringAndEvents": "Monitoring and events",
    "realtimeEvents": "Realtime events",
    "alertRules": "Alert rules",
    "auditLogs": "Audit logs",
    "administration": "Administration",
    "userManagement": "User management",
    "userGroups": "User groups",
    "settings": "Settings",
    "deviceWorkspace": "Device workspace",
    "userDetails": "User details",
    "userGroupDetails": "User group details",
    "console": "MeshCentral Console",
    "collapseMenu": "Collapse menu"
  },
  "header": {
    "searchPlaceholder": "Search devices, users, or IDs...",
    "gatewayConnected": "Gateway connected",
    "gatewayDisconnected": "Gateway disconnected",
    "notifications": "Notifications",
    "help": "Help",
    "account": "Account",
    "profile": "Profile",
    "logout": "Sign out",
    "siteAdministrator": "Site administrator",
    "consoleUser": "Console user"
  },
  "login": {
    "productLine": "Device Management System",
    "slogan": "Secure · Efficient · Controlled",
    "introduction": "MeshCentral provides enterprise-grade remote monitoring and management, helping you securely manage and maintain every endpoint.",
    "realtimeMonitoring": "Realtime monitoring",
    "realtimeMonitoringDescription": "Track device health and activity at a glance",
    "secureAndReliable": "Secure and reliable",
    "secureAndReliableDescription": "Layered safeguards protect your systems and data",
    "efficientManagement": "Efficient management",
    "efficientManagementDescription": "Centralized device operations improve support efficiency",
    "title": "Sign in",
    "subtitle": "Use your local MeshCentral account and password to continue",
    "username": "Username or email",
    "usernamePlaceholder": "Enter your username or email",
    "usernameRequired": "Enter your username or email",
    "password": "Password",
    "passwordPlaceholder": "Enter your password",
    "passwordRequired": "Enter your password",
    "showPassword": "Show password",
    "hidePassword": "Hide password",
    "forgotPassword": "Forgot password?",
    "forgotPasswordTooltip": "Please contact your system administrator to reset credentials",
    "rememberMe": "Remember account and trust this device",
    "submit": "Sign in",
    "register": "Create an account",
    "registrationSucceeded": "Account created. Sign in with your new credentials.",
    "divider": "or",
    "sso": "Sign in with SSO",
    "ssoTooltip": "Single Sign-On (SAML 2.0 / OIDC) is not enabled",
    "badge": "Enterprise Remote Endpoint & Ops Platform",
    "systemOperational": "Gateway & nodes operational",
    "secureChannel": "TLS 1.3 · AES-256 Encrypted Channel",
    "featureTag1": "Low Latency",
    "featureTag2": "Zero Trust",
    "featureTag3": "Cross-Platform",
    "failed": "Sign-in failed. Please try again later.",
    "twoFactorTitle": "Two-factor authentication",
    "twoFactorSubtitle": "Password accepted. Complete verification within {{seconds}} seconds",
    "totpMethod": "Authenticator code",
    "backupMethod": "Backup code",
    "totpCode": "Six-digit authenticator code",
    "backupCode": "Eight-character backup code",
    "totpCodePlaceholder": "Enter the six-digit code",
    "backupCodePlaceholder": "Enter a backup recovery code",
    "twoFactorCodeRequired": "Enter your two-factor code",
    "trustDevice": "Remember two-factor authentication on this device",
    "verifyTwoFactor": "Verify and sign in",
    "backToLogin": "Back to password sign-in",
    "badPassword": "The username or password is incorrect.",
    "accountLocked": "Too many sign-in attempts. Try again later.",
    "invalidTwoFactor": "The two-factor code is incorrect.",
    "twoFactorExpired": "The authentication transaction expired. Sign in again.",
    "twoFactorUnsupported": "This account uses a two-factor method that is not supported here.",
    "emailNotVerified": "The account email address has not been verified.",
    "passwordExpired": "The password has expired. Change it through MeshCentral first.",
    "maintenanceMode": "The server is undergoing maintenance. Try again later.",
    "serviceUnavailable": "The authentication service is unavailable. Try again later."
  },
  "register": {
    "heroTitle": "Create a secure local account",
    "description": "After registration, use the unified console to manage devices and resources you are authorized to access.",
    "firstUserDescription": "This is the first account in the domain. It will receive site administrator privileges.",
    "securityNotice": "Passwords are salted and hashed server-side with PBKDF2-SHA384.",
    "title": "Create account",
    "subtitle": "Enter account details for a local MeshCentral user",
    "firstUserSubtitle": "Create the first site administrator account",
    "username": "Username",
    "usernameRequired": "Enter a username",
    "email": "Email",
    "emailRequired": "Enter an email address",
    "emailInvalid": "Enter a valid email address",
    "password": "Password",
    "passwordRequired": "Enter a password",
    "confirmPassword": "Confirm password",
    "confirmPasswordRequired": "Enter the password again",
    "passwordMismatch": "The passwords do not match",
    "token": "Registration token",
    "tokenRequired": "Enter the registration token",
    "submit": "Create account",
    "backToLogin": "Back to sign in",
    "unavailable": "New account registration is not currently available.",
    "captchaUnsupported": "This domain requires CAPTCHA. Contact an administrator to register through the native MeshCentral page.",
    "errors": {
      "failed": "Registration failed. Try again later.",
      "closed": "New account registration is closed for this domain.",
      "invalidToken": "The registration token is invalid.",
      "invalidUsername": "The username format is invalid.",
      "invalidEmail": "The email address is invalid.",
      "emailDomainNotAllowed": "This email domain is not allowed.",
      "invalidPassword": "The password does not meet the server policy.",
      "usernameExists": "That username already exists.",
      "accountLimitReached": "The server account limit has been reached.",
      "maintenance": "The server is undergoing maintenance. Try again later.",
      "accessDenied": "This domain does not support local account registration.",
      "unavailable": "The registration service is unavailable."
    }
  },
  "notFound": {
    "subTitle": "Page not found"
  },
  "comingSoon": {
    "title": "Coming Soon",
    "subTitle": "The unified console framework is ready. This module will be enabled once the gateway API becomes available."
  },
  "dashboard": {
    "status": {
      "eyebrow": "System posture",
      "healthy": "All systems operational",
      "attentionRequired": "Some devices need attention",
      "gatewayUnavailable": "Gateway is currently unavailable",
      "summary": "{{online}} of {{total}} online, {{attention}} items need attention",
      "updatedAt": "Updated at {{time}}",
      "awaitingUpdate": "Waiting for gateway data"
    },
    "metrics": {
      "totalDevices": "Total devices",
      "totalDevicesHint": "Gateway realtime snapshot",
      "onlineDevices": "Online devices",
      "onlineRate": "{{rate}}% online",
      "deviceGroups": "Device groups",
      "deviceGroupsHint": "Centralized classification",
      "abnormalDevices": "Abnormal devices",
      "offlineRate": "{{rate}}% offline",
      "events24h": "Events (24h)",
      "events24hHint": "Gateway realtime events"
    },
    "trend": {
      "title": "Device status trend",
      "description": "Online and offline device fluctuations in the past 24 hours",
      "tag24h": "24 hours",
      "tag7d": "7 days",
      "tag30d": "30 days",
      "onlineValue": "{{count}} online",
      "offlineValue": "{{count}} offline",
      "loading": "Loading statistics…",
      "ariaTrend": "Trend",
      "ariaDeviceTrend": "Device status trend"
    },
    "welcome": {
      "greeting": "Welcome back,",
      "description": "Here is an overview of your system health",
      "operational": "System operational",
      "lastLogin": "Last login {{time}}",
      "addDevice": "Add device",
      "createUser": "Create user",
      "alertRules": "Set alert rules"
    },
    "attention": {
      "title": "Needs attention",
      "description": "Issues identified from current live state",
      "count": "{{count}} items",
      "gatewayTitle": "Gateway connection issue",
      "gatewayDescription": "Click to reconnect to the gateway now",
      "lastSeen": "Last seen {{time}}",
      "offline": "Device is currently offline",
      "groupHealth": "{{online}} of {{total}} devices online",
      "empty": "No issues require attention"
    },
    "server": {
      "cpu": "CPU load (1/5/15 min)",
      "memory": "Server memory",
      "memoryValue": "{{used}} / {{total}}",
      "agentSessions": "Agent sessions",
      "connectedUsers": "Connected users"
    },
    "gateway": {
      "title": "Gateway connection",
      "description": "Realtime gateway communication status",
      "address": "Gateway address",
      "connectedAt": "Connected at",
      "reconnectCount": "Reconnect attempts",
      "lastMessage": "Last message",
      "gatewayConfigured": "Configured gateway",
      "deviceAvailability": "Device availability"
    },
    "events": {
      "title": "Realtime events",
      "description": "Recent device and system activity",
      "loadFailed": "Failed to load dashboard events",
      "loadFailedDefault": "Failed to load dashboard events.",
      "connecting": "Connecting to realtime event stream…",
      "waiting": "Waiting for realtime events"
    },
    "platforms": {
      "title": "Platform distribution",
      "description": "Operating system breakdown",
      "totalDevices": "Total",
      "other": "Other",
      "empty": "No platform data"
    },
    "groups": {
      "title": "Device groups",
      "description": "Online device overview by group",
      "deviceCount": "{{count}} devices",
      "onlineCount": "{{count}} online",
      "health": "{{online}} of {{total}} online",
      "noDevices": "No devices",
      "empty": "No device groups"
    }
  },
  "devices": {
    "title": "All devices",
    "subtitle": "View devices, groups, and realtime online status synced from gateway",
    "countTag": "{{filtered}} / {{total}} devices",
    "totalCount": "{{count}} devices in total",
    "filters": {
      "searchPlaceholder": "Search name, ID, IP, platform...",
      "allGroups": "All groups",
      "ungrouped": "Ungrouped",
      "allStatus": "All statuses",
      "allPlatforms": "All platforms"
    },
    "powerActions": {
      "wake": "Wake",
      "reset": "Restart",
      "sleep": "Sleep",
      "poweroff": "Power off"
    },
    "actions": {
      "batchOperations": "Batch operations",
      "batchOperationsCount": "Batch operations ({{count}})",
      "batchUpload": "Batch file upload",
      "batchUploadCount": "Batch file upload ({{count}})",
      "addDevice": "Add device",
      "executeCommand": "Run command",
      "workspace": "Workspace",
      "fileManagement": "File management",
      "moveGroup": "Move group",
      "manageFilesAria": "Manage files for {{name}}",
      "openWorkspaceAria": "Open workspace for {{name}}",
      "deviceActionAria": "Actions for {{name}}"
    },
    "columns": {
      "type": "Type",
      "name": "Device name",
      "groupName": "Group",
      "ip": "IP",
      "desc": "Description",
      "status": "Status",
      "lastSeenAt": "Last seen",
      "creation": "Created at",
      "lastbootuptime": "Last boot",
      "actions": "Actions"
    },
    "confirm": {
      "powerTitle": "{{action}} device",
      "powerContent": "Are you sure you want to {{action}} \"{{name}}\"?",
      "powerOk": "Confirm {{action}}",
      "deleteTitle": "Delete device",
      "deleteContent": "Are you sure you want to delete device \"{{name}}\"? This action cannot be undone.",
      "deviceId": "Device ID: {{id}}",
      "groupAndStatus": "Group: {{group}}; Status: {{status}}",
      "deleteOk": "Delete device",
      "batchPowerTitle": "Batch {{action}}",
      "batchPowerContent": "Are you sure you want to {{action}} {{count}} devices?",
      "batchPowerSkipped": "{{count}} devices without permission or currently unavailable will be skipped.",
      "batchPowerNotice": "Submitting the request does not mean the operation has finished on the device."
    },
    "messages": {
      "powerSuccess": "Sent {{action}} command to \"{{name}}\"",
      "powerFailed": "Failed to send {{action}} command: {{detail}}",
      "deleteSuccess": "Deleted \"{{name}}\"",
      "deleteFailed": "Failed to delete device: {{detail}}",
      "batchPowerNoTargets": "No eligible devices found for this action.",
      "batchPowerSuccess": "Submitted {{action}} request to {{count}} devices.",
      "batchPowerPartial": "Submitted {{action}} request to {{success}} devices, failed for {{failed}} devices.",
      "batchPowerFailed": "Failed to submit {{action}} request: {{detail}}",
      "batchSnapshotWarning": "Operation submitted, but failed to refresh device snapshot: {{detail}}. Data may be outdated.",
      "permissionWakeDenied": "Current account is not authorized to wake this device",
      "permissionPowerDenied": "Current account is not authorized to perform power actions on this device",
      "permissionEditDenied": "Current account is not authorized to edit this device",
      "permissionDeleteDenied": "Current account is not authorized to delete this device",
      "permissionCommandDenied": "Current account is not authorized to execute commands",
      "permissionFilesDenied": "Current account is not authorized to manage files on this device"
    },
    "empty": {
      "filtered": "No devices match the filter criteria",
      "waiting": "Waiting for gateway to sync devices"
    },
    "editModal": {
      "title": "Edit device",
      "name": "Device name",
      "nameRequired": "Please enter device name",
      "desc": "Description",
      "tags": "Tags",
      "tagsPlaceholder": "Type tag and press Enter",
      "group": "Group",
      "groupPlaceholder": "Select group",
      "success": "Updated \"{{name}}\"",
      "permissionDenied": "You cannot manage the device's current group, or its permission state is not yet known.",
      "movePermissionDenied": "Manage-computers permission is missing on the source or target group, so the device cannot be moved.",
      "failed": "Failed to update device: {{detail}}"
    },
    "inviteModal": {
      "title": "Add device (Mesh Agent)",
      "groupInstall": "Install Agent",
      "groupUninstall": "Uninstall Agent",
      "deviceGroup": "Device group",
      "groupPlaceholder": "Select device group",
      "systemArch": "Architecture",
      "installMode": "Installation mode",
      "connectMode": "Connection mode",
      "installModes": {
        "both": "Background service and interactive mode",
        "serviceOnly": "Background service only",
        "interactiveOnly": "Interactive mode only"
      },
      "copyCommand": "Copy command",
      "downloadBinary": "Download preconfigured binary installer",
      "binaryNote": "After downloading, register the agent as a service or run in foreground as required by the OS.",
      "macosPrivacyNote": "Grant accessibility, screen recording, and other macOS privacy permissions as needed after installation.",
      "mobileScanTip": "Scan the QR code with the MeshCentral Android app to pair.",
      "downloadAndroidApk": "Download Android APK",
      "assistantTip": "MeshCentral Assistant is an on-demand user session app.",
      "uninstallTip": "Download and run the uninstaller as administrator.",
      "binaryInstaller": "Binary installer",
      "mobileDevices": "Mobile devices",
      "mshFile": "Mesh Agent config file (.msh)"
    }
  },
  "deviceGroups": {
    "title": "Device groups",
    "subtitle": "Manage device groups and view device counts under each group",
    "createGroup": "New group",
    "searchPlaceholder": "Search group name, description...",
    "countTag": "{{filtered}} / {{total}} groups",
    "totalCount": "{{count}} groups in total",
    "columns": {
      "name": "Group name",
      "desc": "Description",
      "deviceCount": "Devices",
      "deviceStats": "Statistics",
      "creation": "Created at",
      "creator": "Creator",
      "actions": "Actions"
    },
    "actions": {
      "viewDevices": "View devices",
      "edit": "Edit",
      "delete": "Delete"
    },
    "confirm": {
      "deleteTitle": "Delete device group",
      "deleteContent": "Are you sure you want to delete group \"{{name}}\"? It currently contains {{count}} devices. Migration or deletion policy is determined by the server.",
      "deleteOk": "Delete group"
    },
    "messages": {
      "createSuccess": "Device group created",
      "updateSuccess": "Device group updated",
      "saveFailed": "Failed to save group: {{detail}}",
      "permissionDenied": "You do not have permission to modify this device group, or the permission state is not yet known.",
      "deleteSuccess": "Deleted group \"{{name}}\"",
      "deleteFailed": "Failed to delete group: {{detail}}"
    },
    "empty": {
      "filtered": "No groups match the filter criteria",
      "waiting": "Waiting for gateway to sync groups"
    },
    "modal": {
      "createTitle": "New device group",
      "editTitle": "Edit device group",
      "name": "Group name",
      "nameRequired": "Please enter group name",
      "desc": "Description",
      "createOk": "Create group",
      "editOk": "Save changes"
    }
  },
  "events": {
    "title": "Realtime events",
    "subtitle": "Historical records and live stream events are automatically merged.",
    "disconnectedWarning": "Realtime connection lost. Displayed content may not be up to date.",
    "loadFailed": "Failed to load historical events",
    "loadFailedDefault": "Historical event query failed.",
    "countOption": "{{count}} items",
    "columns": {
      "time": "Time",
      "type": "Type",
      "device": "Device",
      "user": "User",
      "ip": "Source IP",
      "content": "Content",
      "actions": "Actions"
    },
    "filters": {
      "all": "All",
      "agentlog": "Agent log",
      "relaylog": "Relay log",
      "manual": "Manual operation",
      "runcommands": "Command execution",
      "batchupload": "Batch upload",
      "changenode": "Device changed",
      "removenode": "Device removed"
    },
    "types": {
      "deviceOnline": "Device online",
      "deviceOffline": "Device offline",
      "deviceChanged": "Device changed",
      "deviceRemoved": "Device removed",
      "relayLog": "Relay log",
      "agentLog": "Agent log",
      "manualOperation": "Manual operation",
      "commandExecution": "Command execution",
      "batchUpload": "Batch upload",
      "userSessionCount": "Session stats",
      "unknown": "Other event"
    },
    "terminalRelay": {
      "sessionStart": "Terminal session started",
      "sessionEnd": "Terminal session ended"
    },
    "empty": {
      "loading": "Loading historical events",
      "waitingConnection": "Waiting for gateway connection",
      "empty": "No events"
    },
    "drawer": {
      "title": "Event details",
      "time": "Time",
      "type": "Type",
      "device": "Device",
      "user": "User",
      "ip": "Source IP",
      "content": "Content",
      "relayFields": "Relay extended fields",
      "agentFields": "Agent extended fields",
      "terminalAudit": "Terminal audit event",
      "protocol": "Protocol",
      "bytesIn": "Bytes received by server",
      "bytesOut": "Bytes sent by server",
      "endReason": "End reason",
      "msgId": "Message ID",
      "msgArgs": "Message args",
      "sessionId": "Session ID",
      "remoteAddr": "Remote address",
      "rawTitle": "Sanitized raw data"
    }
  },
  "users": {
    "title": "User management",
    "subtitle": "Manage MeshCentral local accounts and lock statuses",
    "createUser": "Create user",
    "searchPlaceholder": "Search username, real name or email",
    "countTag": "{{filtered}} / {{total}} users",
    "totalCount": "{{count}} users in total",
    "gatewayDisconnectedNotice": "Showing last synced data. Write operations are disabled. Automatically refreshed once reconnected.",
    "loadFailed": "Failed to load user list",
    "reload": "Reload",
    "filters": {
      "all": "All users",
      "active": "Active",
      "locked": "Locked",
      "administrator": "Site administrator",
      "resetRequired": "Password reset required"
    },
    "status": {
      "active": "Active",
      "locked": "Locked",
      "resetRequired": "Reset password",
      "siteAdmin": "Site administrator",
      "standardUser": "Standard user",
      "neverLoggedIn": "Never logged in",
      "unknown": "Unknown",
      "onlineWithCount": "Online · {{count}}"
    },
    "columns": {
      "user": "User",
      "status": "Status",
      "type": "Account type",
      "online": "Online status",
      "lastLoginAt": "Last login",
      "lastAccessAt": "Last access",
      "actions": "Actions"
    },
    "confirm": {
      "lockTitle": "Disable user",
      "unlockTitle": "Enable user",
      "lockContent": "Are you sure you want to disable user \"{{name}}\"? It is not yet confirmed whether disabling terminates existing sessions immediately.",
      "unlockContent": "Are you sure you want to enable user \"{{name}}\"?",
      "deleteTitle": "Delete user",
      "deleteNotice": "User \"{{name}}\" will be permanently deleted. This action cannot be undone. Last login: {{lastLogin}}.",
      "deleteInputTip": "Please type the username to confirm deletion:",
      "deleteOk": "Permanently delete"
    },
    "messages": {
      "createSuccess": "Created user \"{{username}}\"",
      "createUncertain": "User may have been created, but failed to refresh list. Please refresh and do not resubmit.",
      "createFailed": "Failed to create user: {{detail}}",
      "lockSuccess": "Account \"{{name}}\" disabled",
      "unlockSuccess": "Account \"{{name}}\" enabled",
      "lockUncertain": "Account disable request succeeded, but list refresh failed. Active session status unconfirmed.",
      "lockFailed": "Failed to {{action}} user: {{detail}}",
      "deleteSuccess": "Deleted user \"{{name}}\"",
      "deleteFailed": "Failed to delete user: {{detail}}",
      "cannotModifySelf": "Cannot disable or enable currently logged-in user.",
      "cannotDeleteSelf": "Cannot delete currently logged-in user.",
      "cannotLockLastAdmin": "Cannot disable the last active site administrator.",
      "cannotDeleteLastAdmin": "Cannot delete the last active site administrator.",
      "targetUserNotFound": "Target user no longer exists. Please refresh the list."
    },
    "empty": {
      "filtered": "No users match filter criteria",
      "waiting": "No user data"
    },
    "modal": {
      "createTitle": "Create User",
      "createSubtitle": "Configure new user credentials and security policies",
      "accountAndCredentials": "Account and credentials",
      "username": "Username",
      "usernameRequired": "Please enter username",
      "usernamePlaceholder": "e.g. ops_admin or alex",
      "passwordMode": "Password creation mode",
      "manualPassword": "Set initial password manually",
      "randomPassword": "Generate random password on server",
      "password": "Initial password",
      "passwordRequired": "Please enter initial password",
      "passwordPlaceholder": "Enter initial password",
      "confirmPassword": "Confirm password",
      "confirmPasswordRequired": "Please confirm password",
      "confirmPasswordPlaceholder": "Re-enter to confirm",
      "passwordMismatch": "The two passwords that you entered do not match",
      "randomPasswordNoticeTitle": "System-generated strong random password",
      "randomPasswordNoticeDesc": "After creation, the server will return the password shown in notification. Please record it promptly.",
      "personalInfo": "Personal & Contact Information",
      "optional": "Optional",
      "realName": "Full name",
      "realNamePlaceholder": "e.g. John Doe",
      "phone": "Phone number",
      "phonePlaceholder": "e.g. +1 555-0100",
      "email": "Email address",
      "emailInvalid": "Please enter a valid email address",
      "emailPlaceholder": "e.g. user@example.com"
    },
    "editDrawer": {
      "title": "Edit {{name}}",
      "titleDefault": "Edit user",
      "invalidImageType": "Please select a JPG, PNG, GIF, or WebP image.",
      "avatarTooLarge": "Avatar image must not exceed 10 MB.",
      "readAvatarFailed": "Failed to read avatar image.",
      "avatar": "Avatar",
      "selectImage": "Select image",
      "restoreAvatar": "Restore current avatar",
      "username": "Username",
      "email": "Email",
      "realName": "Full name",
      "phone": "Phone"
    }
  },
  "commands": {
    "status": { "submitting": "Submitting", "running": "Running", "succeeded": "Succeeded", "failed": "Failed", "cancelled": "Cancelled", "timedOut": "Timed out", "unknown": "Unknown" },
    "templates": { "hostname": "Hostname", "currentUser": "Current user", "windowsNetwork": "Windows network info", "windowsDisk": "Windows disk space", "unixDisk": "Unix disk space" },
    "errors": { "submitFailed": "Failed to submit command" }, "confirmKeyword": "CONFIRM", "titleSingle": "Run command on {{name}}", "titleBatch": "Run command on {{count}} devices", "deviceDefault": "device",
    "columns": { "device": "Device", "status": "Status", "exitCode": "Exit code", "duration": "Duration", "durationSeconds": "{{seconds}} s", "outputSummary": "Output summary", "actions": "Actions" }, "actions": { "stopClose": "Stop waiting and close", "close": "Close", "runCount": "Run ({{count}})", "view": "View", "copy": "Copy", "output": "Output" }, "descriptions": { "target": "Target", "targetCount": "{{count}} devices", "eligible": "Eligible", "skipped": "Skipped" }, "alerts": { "gatewayDisconnected": "Gateway disconnected", "skippedNotice": "{{count}} devices will be skipped" }, "shells": { "auto": "Auto", "shell": "Shell", "powershell": "PowerShell" }, "runAs": { "default": "Default account", "user": "Current user", "system": "System account" }, "timeoutSeconds": "{{seconds}} s timeout", "templatePlaceholder": "Select command template", "commandPlaceholder": "Enter a command, then press Ctrl/Cmd + Enter to submit", "sensitiveNotice": "This command may contain sensitive information and will not be added to command history", "dangerousTitle": "High-risk command detected", "dangerousDescription": "This action cannot be automatically undone. Type \"CONFIRM\" before submitting.", "dangerInputPlaceholder": "Enter confirmation text", "recentCommands": "Recent commands", "statusMessage": "Execution status: {{status}}", "trackingStopped": "Local waiting stopped; the remote command may still be running.", "requestId": "Request ID: {{id}}", "gatewayOutputUnavailable": "The gateway has not provided output.", "modals": { "sensitiveTitle": "Sensitive command", "sensitiveContent": "This command will run on {{count}} devices. Continue?", "continueRun": "Continue", "stopWaitTitle": "Stop waiting for command results?", "stopWaitContent": "Local waiting will stop; the remote command may still be running.", "stopWaitOk": "Stop waiting", "continueWait": "Continue waiting" }
  },
  "batchOperations": {
    "moveTitle": "Move devices in bulk",
    "columns": { "device": "Device", "deviceId": "Device ID", "status": "Status", "detail": "Detail" },
    "status": { "queued": "Queued", "running": "Running", "submitted": "Submitted", "succeeded": "Succeeded", "failed": "Failed", "skipped": "Skipped" },
    "submitButton": "Move {{count}} devices",
    "completedNotice": "Submitted {{count}} devices",
    "completedDesc": "Bulk move results are shown below.",
    "selectGroupPrompt": "Select a target device group",
    "selectTargetGroupPlaceholder": "Select target group",
    "moveCountNotice": "{{count}} devices will move to \"{{name}}\"",
    "classificationSummary": "Denied: {{denied}}; permission unknown: {{unknown}}; already in target: {{sameTarget}}.",
    "skipReasons": { "permissionDenied": "Manage-computers permission is missing on the source or target group.", "permissionUnknown": "Permissions for the source or target group are not yet known.", "sameTarget": "The device is already in the target group." },
    "allTargetsEligible": "All selected devices can be moved.",
    "skippedSameGroup": "{{count}} devices are already in the target group.",
    "close": "Close"
  },
  "batchUpload": {
    "close": "Close", "startUpload": "Start upload", "retryFailed": "Retry all failed tasks", "cancelAll": "Cancel all", "selectFiles": "Select files",
    "details": { "deviceOffline": "Device is offline; no file relay was established.", "remoteFileExists": "A file with the same name already exists remotely.", "cancelledByUser": "Cancelled by user.", "cancelling": "Cancelling upload…", "gatewayDisconnected": "Gateway disconnected; task did not start.", "workerError": "Upload worker error.", "workerBusy": "Upload worker is busy." },
    "modalTitle": "Batch upload ({{count}} devices)", "messages": { "selectFilesFirst": "Select files first.", "gatewayUnavailable": "The gateway is unavailable.", "duplicateFileNames": "The selected files contain duplicate names." }, "validation": { "directoryNullByte": "The target directory cannot contain null characters.", "directoryRequired": "Enter a target directory.", "directoryTraversal": "The target directory cannot contain parent traversal.", "fileNameRequired": "The file name cannot be empty.", "fileNameNullByte": "The file name cannot contain null characters.", "fileNameInvalid": "The file name contains invalid path characters." }, "closeRunningConfirmTitle": "Close upload task?", "closeRunningConfirmContent": "Uploads are still running. Closing will cancel the current tasks.", "closeRunningConfirmOk": "Cancel and close", "closeRunningConfirmCancel": "Keep uploading", "columns": { "device": "Device", "platform": "Platform", "file": "File", "status": "Status", "progress": "Progress", "bytes": "Bytes", "duration": "Duration", "detail": "Detail", "action": "Action" }, "status": { "queued": "Queued", "connecting": "Connecting", "checking": "Checking", "uploading": "Uploading", "success": "Success", "skipped": "Skipped", "failed": "Failed", "cancelling": "Cancelling", "cancelled": "Cancelled" }, "mixedPlatformTitle": "Multiple device platforms detected", "mixedPlatformDesc": "Different platforms may use different file path rules.", "fileLabel": "Files", "filesSelectedInfo": "{{count}} files selected · {{size}}", "noFilesSelected": "No files selected", "targetDirectory": "Target directory", "targetDirectoryRequired": "Enter a target directory", "targetDirectoryPlaceholder": "For example: /tmp or C:\\Temp", "concurrency": "Concurrent uploads", "overwritePolicy": "Existing file handling", "policySkip": "Skip existing files", "policyOverwrite": "Overwrite existing files", "startNoticeTitle": "{{fileCount}} files will be uploaded to {{deviceCount}} devices", "startNoticeDesc": "Uploads will run in the background.", "statistics": { "total": "Total tasks", "queued": "Queued", "active": "Active", "success": "Success", "skipped": "Skipped", "failed": "Failed", "cancelled": "Cancelled" }, "gatewayDisconnectedTitle": "Gateway disconnected", "gatewayDisconnectedDesc": "New upload tasks cannot start."
  },
  "profile": {
    "title": "Profile",
    "subtitle": "Manage your account identity, contact email, and sign-in credentials",
    "connected": "Account service connected",
    "disconnected": "Account service disconnected",
    "unavailable": "Your account profile has not loaded yet. Try again after the gateway connects.",
    "siteAdministrator": "Site administrator",
    "standardUser": "Standard user",
    "selectAvatar": "Select new avatar",
    "saveAvatar": "Save avatar",
    "avatarHint": "JPG, PNG, GIF, or WebP up to 10 MB. Images are cropped and compressed to 256 × 256 in your browser.",
    "readOnly": "Read only",
    "notAvailable": "No record",
    "basic": { "title": "Basic profile", "description": "Used for account identification and system notifications", "username": "Username", "email": "Email address", "saveEmail": "Update email" },
    "account": { "title": "Account information", "description": "Account lifecycle and recent access records", "createdAt": "Created", "lastLogin": "Last login", "previousLogin": "Previous login", "lastAccess": "Last access" },
    "logins": { "title": "Recent sign-ins", "description": "Recent sign-in sources and client environments for this account", "refresh": "Refresh", "retry": "Retry", "loading": "Loading sign-in history", "loadFailed": "Failed to load sign-in history", "empty": "No recent sign-in records", "messageCode": "Event code {{code}}" },
    "security": {
      "title": "Security", "description": "Sign-in credentials and verification status", "password": "Sign-in password", "change": "Change", "emailVerification": "Email verification", "verified": "Email address is verified", "unverified": "The new email is not verified", "enabled": "Verified", "pending": "Pending", "twoFactor": "Two-factor authentication", "twoFactorDescription": "Verification methods available to this account", "twoFactorForced": "The server requires two-factor authentication for this account", "twoFactorLocked": "Policy locked", "twoFactorLoading": "Checking available verification methods", "twoFactorLoadFailed": "Two-factor authentication capabilities could not be loaded", "twoFactorUnavailable": "Two-factor authentication is disabled for this server or domain", "retry": "Retry", "canConfigure": "Available", "requirementsMissing": "Setup required", "unavailable": "Disabled", "sessions": "Signed-in sessions", "sessionsDescription": "Session management controls are not available yet", "displayOnly": "Display only", "capabilitiesNotice": "This list shows the verification methods allowed by the server. Setup flows will be connected separately.",
      "twoFactorMethods": { "totp": "Authenticator app", "webauthn": "Security key", "email": "Email code", "sms": "SMS code", "messaging": "Messaging", "duo": "Duo Security", "devicePush": "Device push", "backupCodes": "Recovery codes" },
      "management": { "enable": "Enable", "disable": "Disable", "manage": "Manage", "configured": "Enabled", "operationFailed": "Operation failed: {{detail}}", "totpTitle": "Enable authenticator app", "totpInstructions": "Scan the QR code with an authenticator app, or enter the secret manually, then enter the 6-digit code generated by the app.", "totpCode": "Verification code", "totpCodeRequired": "Enter the verification code", "totpCodeInvalid": "Enter a 6-digit verification code", "confirmTotp": "Verify and enable", "totpEnabled": "Authenticator app enabled.", "totpDisabled": "Authenticator app disabled.", "disableTotpTitle": "Disable authenticator app?", "disableTotpDescription": "You will no longer be able to use this method when signing in.", "enableEmailTitle": "Enable email codes?", "enableEmailDescription": "A one-time code can be sent to your verified email address when signing in.", "disableEmailTitle": "Disable email codes?", "disableEmailDescription": "You will no longer be able to use email codes when signing in.", "emailEnabled": "Email codes enabled.", "emailDisabled": "Email codes disabled.", "backupCodesTitle": "Recovery codes", "backupCodesNotice": "Store unused recovery codes in a secure place. Each code can be used once, and regenerating codes invalidates the previous set.", "regenerate": "Regenerate", "disableBackupCodesTitle": "Disable recovery codes?", "disableBackupCodesDescription": "All existing recovery codes will become invalid immediately.", "backupCodesDisabled": "Recovery codes disabled." }
    },
    "password": { "title": "Change sign-in password", "notice": "Other signed-in sessions may need to authenticate again after the password changes.", "current": "Current password", "new": "New password", "confirm": "Confirm new password", "submit": "Update password" },
    "validation": { "emailRequired": "Enter an email address", "emailInvalid": "Enter a valid email address", "currentPasswordRequired": "Enter your current password", "newPasswordRequired": "Enter a new password", "confirmPasswordRequired": "Enter the new password again", "passwordMismatch": "The new passwords do not match" },
    "messages": { "invalidImageType": "Select a JPG, PNG, GIF, or WebP image.", "avatarTooLarge": "The avatar must be no larger than 10 MB.", "imageReadFailed": "The avatar file could not be read.", "avatarUpdated": "Avatar updated.", "avatarUpdateFailed": "Failed to update avatar: {{detail}}", "emailUnchanged": "The email address has not changed.", "emailUpdated": "Email address updated. Complete verification if required by the server.", "emailUpdateFailed": "Failed to update email: {{detail}}", "passwordUpdated": "Sign-in password updated.", "passwordUpdateFailed": "Failed to update password: {{detail}}" }
  },
  "userDetails": {
    "drawerTitle": "User details: {{name}}",
    "administrator": "Site administrator",
    "standardUser": "Standard user",
    "normal": "Normal",
    "locked": "Locked",
    "onlineSessions": "Online ({{count}} sessions)",
    "tabs": { "overview": "Overview", "deviceGroups": "Device groups", "userGroups": "User groups", "sharedDevices": "Shared devices", "logs": "Activity log" },
    "events": {
      "title": "Recent activity log", "time": "Time", "type": "Activity type", "content": "Activity", "resource": "Device/resource", "ip": "IP address", "empty": "No activity logs",
      "types": { "deviceOnline": "Device online", "deviceOffline": "Device offline", "deviceChanged": "Device changed", "deviceRemoved": "Device removed", "relayLog": "Remote connection", "agentLog": "Agent log", "manualOperation": "Manual operation", "commandExecution": "Command execution", "batchUpload": "Batch upload", "userSessionCount": "Session change", "unknown": "Other" }
    },
    "columns": { "name": "Name", "permission": "Permission", "actions": "Actions" },
    "actions": { "add": "Add", "remove": "Remove", "confirmRemove": "Confirm removal", "unavailable": "This action is unavailable.", "editProfile": "Edit profile", "setPermissions": "Set permissions", "setFeatures": "Set features", "backToList": "Back to user list" },
    "itemsCount": "{{count}} items", "empty": { "access": "No {{title}}" }, "loading": "Loading user details", "breadcrumb": "Breadcrumb", "loadFailed": "Failed to load user details", "gatewayDisconnected": "Gateway is not connected.", "partialRefreshFailed": "{{successMessage}}, but the list failed to refresh.", "missing": "Not provided", "missingRealName": "No full name provided", "missingEmail": "No email provided", "neverLoggedIn": "Never logged in", "activeSessions": "Active sessions",
    "status": { "locked": "Locked", "userOnline": "User is currently online", "userOffline": "User is currently offline" },
    "fields": { "id": "User ID", "username": "Username", "realName": "Full name", "email": "Email", "phone": "Phone", "accountStatus": "Account status", "accountType": "Account type", "online": "Online now", "userId": "User ID", "createdAt": "Created at", "lastLoginAt": "Last login", "lastAccessAt": "Last access", "passwordChangedAt": "Password changed", "sitePermissions": "Site permissions" },
    "confirm": { "disableTitle": "Disable user", "enableTitle": "Enable user", "disableContent": "Disable user \"{{name}}\"?", "enableContent": "Enable user \"{{name}}\"?", "deleteTitle": "Delete user", "deleteContent": "Permanently delete user \"{{name}}\"? This action cannot be undone.", "deleteOk": "Permanently delete", "removeGroupTitle": "Remove device group permission", "removeGroupContent": "Remove direct permission for user \"{{user}}\" on device group \"{{name}}\"? The user may still inherit access through a user group.", "removeDeviceTitle": "Remove device permission", "removeDeviceContent": "Remove direct permission for user \"{{user}}\" on device \"{{name}}\"?" },
    "messages": { "profileUnchanged": "User profile has not changed.", "userUpdated": "Updated user \"{{name}}\"", "userUpdateFailed": "Failed to update user: {{detail}}", "siteRightsUpdated": "Updated site permissions for user \"{{name}}\"", "siteRightsFailed": "Failed to set user permissions: {{detail}}", "featureRestrictionsUpdated": "Updated feature restrictions for user \"{{name}}\"", "featureRestrictionsFailed": "Failed to set user features: {{detail}}", "userDisabled": "Account \"{{name}}\" disabled", "userEnabled": "Account \"{{name}}\" enabled", "userDeleted": "Deleted user \"{{name}}\"", "groupAdded": "Added device group \"{{name}}\"", "groupUpdated": "Updated permissions for \"{{name}}\"", "groupSaveFailed": "Failed to save device group permissions: {{detail}}", "groupRemoved": "Removed device group \"{{name}}\"", "groupRemoveFailed": "Failed to remove device group permissions: {{detail}}", "deviceAdded": "Added device \"{{name}}\"", "deviceUpdated": "Updated permissions for \"{{name}}\"", "deviceSaveFailed": "Failed to save device permissions: {{detail}}", "deviceRemoved": "Removed device \"{{name}}\"" },
    "errors": { "unknown": "Unknown error", "invalidRights": "The selected permissions do not apply to an individual device. Please choose again.", "accessDenied": "The current account is not authorized to perform this action.", "invalidUser": "The target user does not exist or is unavailable.", "invalidDevice": "The target device does not exist or is unavailable.", "userDeleted": "The target user does not exist or has been deleted.", "dataNotLoaded": "User data has not loaded.", "userDeletedReturn": "The target user no longer exists. Return to the user list.", "cannotEditCurrentPermissions": "You cannot modify permissions for the current signed-in user.", "cannotRemoveLastAdmin": "You cannot remove site administrator rights from the last sign-in-capable user.", "cannotChangeCurrentStatus": "You cannot disable or enable the current signed-in user.", "cannotDisableLastAdmin": "You cannot disable the last sign-in-capable site administrator.", "cannotDeleteCurrent": "You cannot delete the current signed-in user.", "cannotDeleteLastAdmin": "You cannot delete the last sign-in-capable site administrator.", "cannotEditCurrentDeviceGroups": "You cannot modify device group permissions for the current signed-in user.", "groupDeleted": "The target device group does not exist or has been deleted.", "cannotEditCurrentDevices": "You cannot modify device permissions for the current signed-in user.", "deviceDeleted": "The target device does not exist or has been deleted." }
  },
  "featureRestrictions": {
    "title": "Set user features",
    "notice": "Select the features to disable or restrict for user \"{{name}}\". Unselected features remain available.",
    "status": {
      "unrestricted": "No restrictions (all features available)",
      "restricted": "{{count}} feature(s) restricted"
    },
    "categories": {
      "remote": "Remote Access & Control",
      "system": "System Management & Commands",
      "maintenance": "Maintenance & Power"
    },
    "restoreAll": "Restore all features",
    "selectGroup": "Select group",
    "deselectGroup": "Clear group",
    "broadImpactTag": "Global restriction",
    "remoteControlNotice": "Disabling all remote control blocks desktop, terminal, files, and all other remote features.",
    "items": {
      "remoteControl": { "label": "Disable all remote control", "description": "Desktop, terminal, files, and all other remote features are unavailable." },
      "desktopAccess": { "label": "Disable remote desktop", "description": "Remote desktop sessions cannot be established." },
      "remoteViewOnly": { "label": "Remote desktop view only", "description": "The desktop is visible, but mouse and keyboard input are disabled." },
      "terminalAccess": { "label": "Disable remote terminal", "description": "Terminal and shell access are unavailable." },
      "fileAccess": { "label": "Disable device files", "description": "Device files cannot be browsed, uploaded, or downloaded." },
      "registryAccess": { "label": "Disable Windows registry", "description": "The Windows registry cannot be viewed or modified." },
      "softwareAccess": { "label": "Disable software management", "description": "The installed software list cannot be viewed or managed." },
      "agentConsole": { "label": "Disable Agent console", "description": "The internal MeshAgent console is unavailable." },
      "uninstall": { "label": "Disable remote Agent uninstall", "description": "The client Agent cannot be remotely uninstalled." },
      "remoteCommand": { "label": "Disable background commands", "description": "Silent remote commands cannot be executed in the background." },
      "wake": { "label": "Disable network wake", "description": "Wake-on-LAN is unavailable." },
      "resetOff": { "label": "Disable power operations", "description": "Shutdown, restart, sleep, and other power operations are unavailable." }
    }
  },
  "userGroups": {
    "title": "User groups",
    "subtitle": "Manage user groups and associated permissions for device groups and devices",
    "createGroup": "New user group",
    "searchPlaceholder": "Search user group name, description or ID...",
    "countTag": "{{filtered}} / {{total}} groups",
    "totalCount": "{{count}} user groups in total",
    "loadFailed": "Failed to load user group list",
    "gatewayDisconnectedNotice": "Showing last synced data. Write operations are disabled. Automatically refreshed once reconnected.",
    "filters": {
      "all": "All groups",
      "withMembers": "With members",
      "noMembers": "No members",
      "withPermissions": "With permissions",
      "noPermissions": "No permissions"
    },
    "columns": {
      "name": "Group name",
      "description": "Description",
      "members": "Members",
      "deviceGroups": "Granted device groups",
      "devices": "Granted devices",
      "domainAttributes": "Domain & attributes",
      "actions": "Actions"
    },
    "zeroMembers": "0",
    "zeroDevices": "0",
    "defaultDomain": "Default domain",
    "flags": "Flags {{value}}",
    "readOnly": "Read-only mode",
    "readOnlyDescription": "The current account cannot manage user groups. Lists and details are viewable, but changes are disabled.",
    "cloneMode": "Clone mode",
    "cloneDescription": "Cloning \"{{name}}\". The new group will inherit all device-group and device grants from the original group.",
    "inheritanceTitle": "Permission inheritance",
    "inheritanceDescription": "User groups distribute permissions. Device-group and device permissions configured here are automatically granted to all group members.",
    "actions": {
      "clone": "Clone"
    },
    "confirm": {
      "deleteTitle": "Delete user group",
      "deleteNotice": "User group \"{{name}}\" will be permanently deleted. Group members will lose all permissions granted via this group.",
      "deleteInputTip": "Please type the group name to confirm deletion:",
      "deleteOk": "Permanently delete",
      "irreversible": "This action cannot be undone",
      "deleteImpactTitle": "The following relationships will be permanently removed:",
      "memberImpact": "{{count}} members will lose permissions inherited through this group",
      "deviceGroupImpact": "{{count}} device-group grant configurations will be removed",
      "deviceImpact": "{{count}} device grant configurations will be removed"
    },
    "messages": {
      "createSuccess": "Created user group \"{{name}}\"",
      "updateSuccess": "Updated user group \"{{name}}\"",
      "cloneSuccess": "Cloned user group \"{{name}}\"",
      "mutationUncertain": "Operation submitted, but failed to refresh list. Please refresh before resubmitting.",
      "mutationFailed": "Failed to save user group: {{detail}}",
      "deleteSuccess": "Deleted user group \"{{name}}\"",
      "deleteFailed": "Failed to delete user group: {{detail}}",
      "targetGroupNotFound": "Target user group no longer exists. Please refresh the list."
    },
    "empty": {
      "filtered": "No user groups match filter criteria",
      "waiting": "No user group data"
    },
    "modal": {
      "createTitle": "New user group",
      "editTitle": "Edit user group",
      "cloneTitle": "Clone user group",
      "name": "Group name",
      "nameRequired": "Please enter group name",
      "nameTooLong": "Group name must be 128 characters or fewer",
      "namePlaceholder": "e.g. Operations, External support, R&D observers",
      "description": "Description",
      "descriptionTooLong": "Description must be 1024 characters or fewer",
      "descriptionPlaceholder": "Enter the group's responsibilities, use cases, or grant notes (optional)"
    },
    "details": {
      "memberColumns": { "user": "User", "viewUser": "Open user details", "realName": "Full name", "email": "Email", "status": "Account status", "actions": "Actions" },
      "missing": "Not provided",
      "noManagePermission": "No management permission",
      "deviceGroup": "Device group",
      "device": "Device",
      "groupLabel": "Group: {{name}}",
      "inheritedPermissions": "Inherited permissions",
      "loading": "Loading user group details",
      "breadcrumb": "Breadcrumb",
      "loadFailed": "Failed to load user group",
      "notFound": "User group does not exist or has been deleted",
      "backToList": "Back to user group list",
      "gatewayDisconnected": "Gateway disconnected",
      "gatewayDisconnectedDescription": "Showing the latest cached data. All edits and permission changes are temporarily disabled.",
      "readOnly": "Read-only mode",
      "readOnlyDescription": "The current account cannot manage user groups. Members and inherited grants are viewable, but changes are disabled.",
      "role": "User group role",
      "defaultDomain": "Default domain",
      "defaultDomainValue": "Default domain (default)",
      "noDescription": "No description",
      "systemId": "User group system identifier",
      "fields": { "domain": "Domain", "members": "Group members", "deviceGroups": "Device group grants", "devices": "Individual device grants", "flags": "Flags", "consent": "Consent configuration" },
      "defaultFlags": "Default flags (0)",
      "unrestrictedConsent": "Unrestricted (0)",
      "inheritedTotal": "Total inherited grants",
      "resourceGrants": "resource grants",
      "inheritedForMembers": "Inherited for {{count}} members",
      "tabs": { "overview": "Overview and inheritance", "memberScale": "Group members", "inheritedGroups": "Inherited device groups", "inheritedDevices": "Inherited devices", "members": "Members ({{count}})", "groups": "Device group grants ({{count}})", "devices": "Device grants ({{count}})" },
      "preview": { "members": "Member preview", "resources": "Inherited resource preview" },
      "viewAllCount": "View all ({{count}})",
      "counts": { "members": "{{count}} users", "deviceGroups": "{{count}} device groups", "devices": "{{count}} devices", "people": "{{count}}", "groups": "{{count}}", "filteredMembers": "{{filtered}} / {{total}} members", "filteredGroups": "{{filtered}} / {{total}} device groups", "filteredDevices": "{{filtered}} / {{total}} devices" },
      "search": { "members": "Search member name, username or email", "groups": "Search device group name or ID", "devices": "Search device name or ID", "users": "Search username, full name or email" },
      "empty": { "members": "No members", "resources": "No grants configured", "noMembers": "This user group has no members", "noMatchingMembers": "No matching members", "noGroupGrants": "No inherited device group grants", "noMatchingGroups": "No matching device groups", "noDeviceGrants": "No inherited device grants", "noMatchingDevices": "No matching devices" },
      "actions": { "remove": "Remove", "editPermissions": "Edit permissions", "confirmRemove": "Confirm removal", "addMember": "Add member", "addMemberNow": "Add a member now", "addGroupGrant": "Add device group grant", "addFirstGroup": "Configure the first device group", "addDeviceGrant": "Add device grant", "addFirstDevice": "Configure the first device", "selectAll": "Select all", "clear": "Clear", "removeMember": "Remove member", "saveGroupPermissions": "Save device group permissions", "saveDevicePermissions": "Save device permissions", "updateGroup": "Update user group" },
      "errors": { "groupDeleted": "The target device group no longer exists.", "deviceDeleted": "The target device no longer exists." },
      "confirm": { "removeGroupTitle": "Remove device group grant", "removeDeviceTitle": "Remove device grant", "removeContent": "After removal, group members will no longer inherit access to this resource through this user group.", "removeMemberTitle": "Remove user group member", "removeMemberContent": "Remove member \"{{name}}\" from user group \"{{group}}\"?", "removeMemberDescription": "The user will no longer inherit this group's device group and individual device access. The account and direct grants are unaffected." },
      "modals": { "addMemberTitle": "Add member to \"{{name}}\"", "addMemberOk": "Add {{count}} members", "addMemberDescription": "Select accounts to add to this user group. Members will immediately inherit all device group and individual device permissions configured here.", "availableSelected": "Available: {{available}} · Selected: {{selected}}", "editTitle": "Edit user group profile", "descriptionPlaceholder": "Describe the group's responsibilities and grant scope", "deleteTitle": "Confirm user group deletion", "irreversible": "This action cannot be undone", "deleteImpactIntro": "Deleting this user group will:", "deleteMembersImpact": "Remove inherited permissions from {{count}} group members", "deleteGrantsImpact": "Remove {{groups}} device group grants and {{devices}} device grants", "deleteConfirmation": "Type the user group name \"{{name}}\" to confirm deletion:" },
      "validation": { "nameMax": "Name cannot exceed 128 characters", "descriptionMax": "Description cannot exceed 1024 characters" }
    }
  },
  "permissions": {
    "categories": {
      "management": "Account management",
      "server": "Server management",
      "visibility": "Data access",
      "restrictions": "Restrictions",
      "meshManagement": "Device group management",
      "meshAccess": "Remote access",
      "meshOperations": "Device operations"
    },
    "summary": {
      "siteAdmin": "Site administrator",
      "lockedNoSiteRights": "Locked, no site permissions",
      "noSiteRights": "No site permissions",
      "allRights": "Full permissions",
      "groupOnly": "Group visibility only",
      "separator": ", ",
      "itemsAndMore": "{{items}} and {{count}} more"
    },
    "presets": {
      "remoteAccess": "Remote desktop, terminal and files",
      "desktopOnly": "Remote desktop only",
      "filesOnly": "Device file management only",
      "desktopReadonly": "Desktop read-only"
    },
    "riskTag": "Sensitive",
    "actions": {
      "selectAll": "Select all",
      "clear": "Clear",
      "selectGroup": "Select group",
      "deselectGroup": "Deselect group",
      "defaultPreset": "Default",
      "presets": "Common presets",
      "selectPresetPlaceholder": "Select preset combination"
    },
    "siteModal": {
      "title": "Set user permissions",
      "notice": "Configuring site permissions for \"{{name}}\". Account lock status is not modified here.",
      "adminNotice": "Site administrators possess all current and future site permissions."
    },
    "meshModal": {
      "editGroupTitle": "Edit device group permissions",
      "addGroupTitle": "Add device group permissions",
      "addGroupOk": "Add device group",
      "deviceGroup": "Device group",
      "selectGroupPlaceholder": "Select device group to grant",
      "noAvailableGroups": "No device groups available to add",
      "fullAdminRights": "Full administrator rights",
      "fullAdminRightsDesc": "(Possesses all permissions 0xFFFFFFFF)"
    },
    "deviceModal": {
      "editTitle": "Edit device permissions",
      "addTitle": "Add device permissions",
      "addOk": "Add device",
      "device": "Device",
      "selectGroupFirst": "Please select a device group first",
      "selectDevicePlaceholder": "Select device to grant",
      "noAvailableDevices": "No devices available to add",
      "allDeviceRights": "All individual device permissions",
      "fullRightsNotice": "Grants every individual device permission supported by this API.",
      "unsupportedRightsTitle": "The existing grant contains unsupported permissions",
      "unsupportedRightsDescription": "Unsupported permission bits: {{rights}}. Saving is disabled to avoid silently removing the existing grant."
    },
    "site": {
      "manageUsers": {
        "label": "Manage users",
        "description": "Create, edit, and delete user accounts"
      },
      "manageUserGroups": {
        "label": "Manage user groups",
        "description": "Create, edit, and delete user groups"
      },
      "serverBackup": {
        "label": "Server backup",
        "description": "Create and download server backups"
      },
      "serverRestore": {
        "label": "Server restore",
        "description": "Restore server data from backups"
      },
      "serverUpdate": {
        "label": "Server update",
        "description": "Execute MeshCentral server updates"
      },
      "fileAccess": {
        "label": "Server file access",
        "description": "Access server-side file management"
      },
      "recordings": {
        "label": "View recordings",
        "description": "Access remote session recordings"
      },
      "allEvents": {
        "label": "View all events",
        "description": "View events for all users and devices"
      },
      "lockSettings": {
        "label": "Lock settings",
        "description": "Restrict account from changing settings"
      },
      "noNewGroups": {
        "label": "No new groups",
        "description": "Prohibit user from creating device groups"
      },
      "noMeshCommand": {
        "label": "No group commands",
        "description": "Prohibit user from executing group commands"
      },
      "noNewDevices": {
        "label": "No new devices",
        "description": "Prohibit user from adding new devices"
      }
    },
    "mesh": {
      "editGroup": {
        "label": "Edit device group",
        "description": "Modify device group name and description"
      },
      "manageUsers": {
        "label": "Manage group users",
        "description": "Add, remove and manage group member permissions"
      },
      "manageDevices": {
        "label": "Manage devices",
        "description": "Edit, remove or move devices"
      },
      "remoteDesktop": {
        "label": "Remote desktop",
        "description": "View and control remote desktop"
      },
      "agentConsole": {
        "label": "Mesh Agent console",
        "description": "Access Mesh Agent debug console"
      },
      "serverFiles": {
        "label": "Server file space",
        "description": "Access server-side file space"
      },
      "chatNotify": {
        "label": "Desktop notifications",
        "description": "Send notifications and chat messages"
      },
      "remoteCommand": {
        "label": "Run background command",
        "description": "Execute single command on device"
      },
      "wakeDevice": {
        "label": "Wake device",
        "description": "Execute Wake-on-LAN"
      },
      "setNotes": {
        "label": "Modify device notes",
        "description": "Edit device note information"
      },
      "uninstall": {
        "label": "Uninstall Agent",
        "description": "Uninstall Agent on device"
      },
      "resetOff": {
        "label": "Restart and power off",
        "description": "Execute power management operations"
      },
      "guestSharing": {
        "label": "Guest sharing",
        "description": "Create temporary guest sharing link"
      },
      "deviceDetails": {
        "label": "View device details",
        "description": "View hardware and OS details"
      },
      "relay": {
        "label": "Web Relay",
        "description": "Create port relay mappings"
      },
      "remoteViewOnly": {
        "label": "Desktop view only",
        "description": "Desktop session is view-only"
      },
      "noTerminal": {
        "label": "Disable terminal",
        "description": "Explicitly deny terminal access"
      },
      "noFiles": {
        "label": "Disable files",
        "description": "Explicitly deny file access"
      },
      "noAmt": {
        "label": "Disable Intel AMT",
        "description": "Disable Intel AMT functionality"
      },
      "desktopLimitedInput": {
        "label": "Limit desktop input",
        "description": "Limit mouse and keyboard input"
      },
      "limitEvents": {
        "label": "Limit event logs",
        "description": "Limit device event log scope"
      },
      "noDesktop": {
        "label": "Disable remote desktop",
        "description": "Explicitly deny remote desktop"
      },
      "noRegistry": {
        "label": "Disable registry",
        "description": "Prohibit using registry editor"
      },
      "noSoftware": {
        "label": "Disable software management",
        "description": "Prohibit managing installed software"
      }
    }
  },
  "errors": {
    "unknown": "An unknown error occurred. Please try again later.",
    "gatewayDisconnected": "Gateway disconnected",
    "permissionDenied": "Permission denied"
  }
} as const;
