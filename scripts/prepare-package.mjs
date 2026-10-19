import { copyFile } from "node:fs/promises";
// Package managers omit root lockfiles when packing; retain the runtime's pinned dependencies.
await copyFile(
  new URL("../pnpm-lock.yaml", import.meta.url),
  new URL("../runtime/dependencies.lock.yaml", import.meta.url),
);

// Keep application dependencies inside the container even for a minimal public launcher.
await copyFile(
  new URL("../package.json", import.meta.url),
  new URL("../runtime/package.json", import.meta.url),
);
