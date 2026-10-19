#!/bin/sh
set -eu
# Claude Code is distributed by Anthropic under separate terms, not our MIT license.
version=2.1.302
base="$HOME/.sdd-clinic/provider-tools"
prefix="$base/claude-$version"
executable="$prefix/node_modules/.bin/claude"
if [ ! -x "$executable" ]; then
  mkdir -p "$base"
  (
    flock -x 9
    if [ ! -x "$executable" ]; then
      echo "Installing Claude Code $version from its vendor distribution (first use)." >&2
      npm install --prefix "$prefix" --no-audit --no-fund --loglevel=error "@anthropic-ai/claude-code@$version" >&2
      test -x "$executable"
    fi
  ) 9>"$base/claude-install.lock"
fi
exec "$executable" "$@"
