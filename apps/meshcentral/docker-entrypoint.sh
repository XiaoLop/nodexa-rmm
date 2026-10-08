#!/bin/sh
set -eu

# 如果以 root 身份运行，自动修正挂载目录属主为 node 用户
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /var/lib/meshcentral
fi

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

# 确保在复制完内置插件或资源后，文件属主依然归属于 node
if [ "$(id -u)" = "0" ]; then
  chown -R node:node /var/lib/meshcentral
  exec gosu node "$@"
fi

exec "$@"