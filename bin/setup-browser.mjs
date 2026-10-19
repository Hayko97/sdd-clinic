import {
  authUrl,
  lines,
  relay,
  openBrowser,
} from "../runtime/browser-auth.mjs";

export function setupBrowser({
  nonce,
  container,
  docker,
  open = openBrowser,
  warn = console.error,
  fail,
}) {
  let forwarding;
  let chain = Promise.resolve();
  let closed = false;
  const seen = new Set();
  const prefix = `SDDCLINIC_AUTH:${nonce}:`;
  const reader = lines((line) => {
    if (!line.startsWith(prefix)) return;
    let message;
    try {
      message = JSON.parse(line.slice(prefix.length));
    } catch {
      return;
    }
    chain = chain
      .then(async () => {
        if (closed) return;
        if (message.type === "end") {
          await forwarding?.close();
          forwarding = undefined;
          return;
        }
        if (
          message.type !== "open" ||
          !["codex", "claude"].includes(message.engine)
        )
          return;
        const auth = authUrl(message.url, message.engine);
        if (!auth || seen.has(auth.url)) return;
        seen.add(auth.url);
        if (auth.callbackPort) {
          await forwarding?.close();
          forwarding = undefined;
          const result = await docker(["port", container, "1456/tcp"]);
          const match = result.output.trim().match(/^127\.0\.0\.1:(\d+)$/);
          if (result.code || !match)
            throw new Error(
              "Cannot forward the sign-in callback from Docker. Retry setup with local Docker.",
            );
          try {
            forwarding = await relay({
              listenPort: auth.callbackPort,
              targetPort: Number(match[1]),
            });
          } catch {
            throw new Error(
              `Sign-in callback port ${auth.callbackPort} is unavailable. Finish any other provider sign-in using that port, then rerun setup.`,
            );
          }
        }
        if (!(await open(auth.url)))
          warn(
            `Could not open your browser automatically. Open this sign-in link manually:\n${auth.url}`,
          );
      })
      .catch(async (error) => {
        warn(error.message);
        await fail?.(error);
      });
  });
  return {
    push: (chunk) => reader.push(chunk),
    flush: () => chain,
    async close() {
      reader.end();
      await chain;
      closed = true;
      await forwarding?.close();
      forwarding = undefined;
    },
  };
}
