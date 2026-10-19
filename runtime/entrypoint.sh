#!/bin/sh
set -eu
# Never chown the mounted project. Only initialize the private runtime home.
uid="${CLINIC_CLI_UID:-1000}"
gid="${CLINIC_CLI_GID:-1000}"
case "$uid:$gid" in *[!0-9:]*|:*) echo 'Invalid runtime user IDs' >&2; exit 2;; esac
if [ "$(stat -c '%u:%g' /home/node)" != "$uid:$gid" ]; then
  chown -R "$uid:$gid" /home/node
fi
exec setpriv --reuid="$uid" --regid="$gid" --clear-groups "$@"
