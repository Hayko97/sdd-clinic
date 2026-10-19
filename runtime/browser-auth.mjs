import { createServer, createConnection } from "node:net";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

export function authUrl(value, engine) {
  try {
    const url = new URL(value);
    const hosts =
      engine === "codex"
        ? ["auth.openai.com"]
        : ["claude.ai", "console.anthropic.com", "platform.claude.com"];
    if (
      url.protocol !== "https:" ||
      !hosts.includes(url.hostname) ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return null;
    const redirect = url.searchParams.get("redirect_uri");
    let callbackPort;
    if (redirect) {
      const callback = new URL(redirect);
      if (
        callback.protocol !== "http:" ||
        !["localhost", "127.0.0.1"].includes(callback.hostname) ||
        callback.username ||
        callback.password
      )
        return null;
      callbackPort = Number(callback.port || 80);
      if (callbackPort < 1024 || callbackPort > 65535) return null;
    }
    return { url: url.href, callbackPort };
  } catch {
    return null;
  }
}

export function lines(consume) {
  const decoder = new StringDecoder("utf8");
  let pending = "";
  return {
    push(chunk) {
      pending += decoder.write(chunk);
      let index;
      while ((index = pending.indexOf("\n")) >= 0) {
        consume(pending.slice(0, index).replace(/\r$/, ""));
        pending = pending.slice(index + 1);
      }
      if (pending.length > 65536) pending = "";
    },
    end() {
      pending += decoder.end();
      if (pending) consume(pending);
      pending = "";
    },
  };
}

export async function relay({
  listenPort,
  targetPort,
  listenHost = "127.0.0.1",
  targetHost = "127.0.0.1",
}) {
  const sockets = new Set();
  const server = createServer((incoming) => {
    const outgoing = createConnection({ host: targetHost, port: targetPort });
    for (const socket of [incoming, outgoing]) {
      sockets.add(socket);
      socket.on("close", () => sockets.delete(socket));
      socket.on("error", () => {
        incoming.destroy();
        outgoing.destroy();
      });
    }
    incoming.pipe(outgoing).pipe(incoming);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(listenPort, listenHost, resolve);
  });
  return {
    port: server.address().port,
    close: () =>
      new Promise((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(resolve);
      }),
  };
}

export function openBrowser(url) {
  return new Promise((resolve) => {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "rundll32"
          : "xdg-open";
    const args =
      process.platform === "win32"
        ? ["url.dll,FileProtocolHandler", url]
        : [url];
    const child = spawn(command, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
}
