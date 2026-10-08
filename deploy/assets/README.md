# Deployment assets

Files in this directory are mounted read-only at `/data` in the MeshCentral container.

## GeoIP database

The `utils` plugin reads a MaxMind-compatible City MMDB from:

```text
/data/GeoLite2-City.mmdb
```

Place the database at:

```text
deploy/assets/GeoLite2-City.mmdb
```

The database is not committed to this repository. Obtain GeoLite2 City from MaxMind, or use a compatible City MMDB, and comply with its download and redistribution license.

The path can be overridden with `NODEXA_GEOIP_MMDB_PATH`. Replace the file atomically and restart MeshCentral after an update. A monthly update cadence is recommended.

Location flow:

```text
node.publicip or node.ip
  -> utils plugin local MMDB lookup
  -> node.nodexa.location
  -> nodes snapshot / changenode event
  -> Device.location
  -> device list and device workspace
```

The browser does not query the GeoIP database and does not issue one location request per device.