import { afterEach, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { createConnection } from "node:net";
import { Server, utils, type Connection } from "ssh2";
import { SshConnector } from "../src/server/data.js";
import {
  connectionSchema,
  type ConnectionProfile,
} from "../src/shared/types.js";

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

it("verifies SSH host keys, confines SFTP reads, redacts secrets, and forwards a tunnel", async () => {
  const key = utils.generateKeyPairSync("ed25519");
  const parsed = utils.parseKey(key.private);
  if (parsed instanceof Error) throw parsed;
  const fingerprint = `SHA256:${createHash("sha256").update(parsed.getPublicSSH()).digest("base64").replace(/=+$/, "")}`;
  const clients = new Set<Connection>();
  const bytes = Buffer.from("status=healthy\npassword=do-not-disclose\n");
  const server = new Server({ hostKeys: [key.private] }, (client) => {
    clients.add(client);
    client.on("error", () => {});
    client.on("close", () => clients.delete(client));
    client.on("authentication", (ctx) => {
      if (ctx.method === "password" && ctx.password === "fixture") ctx.accept();
      else ctx.reject();
    });
    client.on("ready", () => {
      client.on("session", (accept) =>
        accept().on("sftp", (acceptSftp) => {
          const sftp = acceptSftp();
          sftp.on("REALPATH", (req, path) =>
            sftp.name(req, [
              {
                filename: path === "/logs/escape" ? "/private/secret" : path,
                longname: path,
                attrs: {
                  mode: 0o100644,
                  uid: 1,
                  gid: 1,
                  size: bytes.length,
                  atime: 0,
                  mtime: 0,
                },
              },
            ]),
          );
          sftp.on("STAT", (req) =>
            sftp.attrs(req, {
              mode: 0o100644,
              size: bytes.length,
              uid: 1,
              gid: 1,
              atime: 0,
              mtime: 0,
            }),
          );
          sftp.on("OPEN", (req) => sftp.handle(req, Buffer.from("file")));
          sftp.on("READ", (req, _handle, offset, length) => {
            if (offset >= bytes.length) sftp.status(req, 1);
            else sftp.data(req, bytes.subarray(offset, offset + length));
          });
          sftp.on("CLOSE", (req) => sftp.status(req, 0));
        }),
      );
      client.on("tcpip", (accept, _reject, info) => {
        expect(info.destIP).toBe("database.internal");
        expect(info.destPort).toBe(5432);
        const channel = accept();
        channel.on("data", (chunk: Buffer) => channel.write(chunk));
      });
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () =>
      new Promise<void>((resolve) => {
        for (const client of clients) client.end();
        server.close(() => resolve());
      }),
  );
  const address = server.address() as import("node:net").AddressInfo;
  const profile: ConnectionProfile = {
    ...connectionSchema.parse({
      name: "Fixture SSH",
      kind: "ssh",
      host: "127.0.0.1",
      port: address.port,
      username: "fixture",
      hostKey: fingerprint,
      allowedPaths: ["/logs"],
    }),
    id: "ssh",
    projectId: "p",
    secretStorage: "session",
  };
  const connector = new SshConnector();
  const secret = { password: "fixture" };
  expect(await connector.test(profile, secret)).toMatchObject({
    connected: true,
  });
  await expect(
    connector.test({ ...profile, hostKey: "SHA256:incorrect" }, secret),
  ).rejects.toThrow();
  const content = await connector.read(profile, secret, "/logs/app.log");
  expect(content).toContain("status=healthy");
  expect(content).not.toContain("do-not-disclose");
  await expect(connector.read(profile, secret, "/logs/escape")).rejects.toThrow(
    "outside",
  );
  const tunnel = await connector.tunnel(
    profile,
    secret,
    "database.internal",
    5432,
  );
  cleanups.push(async () => tunnel.close());
  const echoed = await new Promise<string>((resolve, reject) => {
    const socket = createConnection(
      { host: "127.0.0.1", port: tunnel.port },
      () => socket.write("database packet"),
    );
    socket.on("data", (chunk) => {
      resolve(chunk.toString());
      socket.destroy();
    });
    socket.on("error", reject);
  });
  expect(echoed).toBe("database packet");
});
