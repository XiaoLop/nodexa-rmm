# Deployment assets

Files in this directory are mounted read-only at `/data` in the MeshCentral container.

## Device location

The `utils` plugin does not ship or read an IP geolocation database. It reads the IP
location record that MeshCentral already stores under the database key
`iploc_<public IP>` and copies `city`, `region`, `country`, `loc` and `timezone` into
`node.nodexa.location`.

Location flow:

```text
node.publicip or node.ip
  -> utils plugin reads iploc_<ip> from the MeshCentral database
  -> node.nodexa.location
  -> nodes snapshot / changenode event
  -> Device.location
  -> device list and device workspace
```

A location is only available after MeshCentral has stored an `iploc_` record for the
device public IP. Devices without a public IP, or without a stored record, show no
location.