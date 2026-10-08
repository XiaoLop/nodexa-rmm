#!/bin/sh
set -eu

plugin_source=/opt/meshcentral-plugins
plugin_target=/var/lib/meshcentral/data/plugins

if [ "${MESHCENTRAL_SYNC_BUILTIN_PLUGINS:-true}" = "true" ] \
  && [ -d "$plugin_source" ]; then
  mkdir -p "$plugin_target"
  cp -R "$plugin_source/." "$plugin_target/"
fi

if [ -d /data ]; then
  mkdir -p /var/lib/meshcentral/data
  for asset in /data/*.png /data/*.ico; do
    [ -f "$asset" ] || continue
    cp "$asset" /var/lib/meshcentral/data/
  done
fi

exec "$@"