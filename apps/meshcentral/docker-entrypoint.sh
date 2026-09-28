#!/bin/sh
set -eu

plugin_source=/opt/meshcentral-plugins/jsonauth
plugin_target=/var/lib/meshcentral/data/plugins/jsonauth

if [ "${MESHCENTRAL_SYNC_BUILTIN_PLUGINS:-true}" = "true" ] \
  && [ -d "$plugin_source" ]; then
  mkdir -p "$plugin_target"
  cp -R "$plugin_source/." "$plugin_target/"
fi

exec "$@"