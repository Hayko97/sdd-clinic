import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ConnectionProfile, ConnectionSecret } from "../shared/types.js";
import { AppError, atomicWrite } from "./util.js";

export class SecretVault {
  private memory = new Map<string, ConnectionSecret>();
  private keyPromise?: Promise<Buffer>;
  constructor(
    private persistent = true,
    private directory?: string,
  ) {}
  private file(key: string) {
    return join(
      this.directory!,
      `${createHash("sha256").update(key).digest("hex")}.enc`,
    );
  }
  private async key(create: boolean) {
    if (!this.keyPromise)
      this.keyPromise = (async () => {
        await mkdir(this.directory!, { recursive: true, mode: 0o700 });
        await chmod(this.directory!, 0o700);
        const path = join(this.directory!, "vault.key");
        if (create) {
          try {
            await writeFile(path, randomBytes(32), { flag: "wx", mode: 0o600 });
          } catch (e) {
            if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
          }
        }
        await chmod(path, 0o600);
        const key = await readFile(path);
        if (key.length !== 32) throw new Error("Invalid vault key");
        return key;
      })().catch((e) => {
        this.keyPromise = undefined;
        throw e;
      });
    return this.keyPromise;
  }
  async set(
    key: string,
    secret: ConnectionSecret,
  ): Promise<ConnectionProfile["secretStorage"]> {
    if (!Object.values(secret).some(Boolean)) return "none";
    this.memory.set(key, secret);
    if (this.persistent)
      try {
        const { AsyncEntry } = await import("@napi-rs/keyring");
        await new AsyncEntry("sdd-clinic", key).setPassword(
          JSON.stringify(secret),
        );
        return "keyring";
      } catch {}
    if (this.directory)
      try {
        const nonce = randomBytes(12);
        const cipher = createCipheriv(
          "aes-256-gcm",
          await this.key(true),
          nonce,
        );
        cipher.setAAD(Buffer.from(key));
        const ciphertext = Buffer.concat([
          cipher.update(JSON.stringify(secret), "utf8"),
          cipher.final(),
        ]);
        await atomicWrite(
          this.file(key),
          JSON.stringify({
            version: 1,
            nonce: nonce.toString("base64"),
            tag: cipher.getAuthTag().toString("base64"),
            ciphertext: ciphertext.toString("base64"),
          }),
          0o600,
        );
        return "encrypted";
      } catch {}
    return "session";
  }
  async get(
    key: string,
    storage: ConnectionProfile["secretStorage"],
  ): Promise<ConnectionSecret> {
    const memory = this.memory.get(key);
    if (memory) return memory;
    if (storage === "none") return {};
    try {
      if (storage === "keyring") {
        const { AsyncEntry } = await import("@napi-rs/keyring");
        const value = await new AsyncEntry("sdd-clinic", key).getPassword();
        if (value) return JSON.parse(value);
      }
      if (storage === "encrypted" && this.directory) {
        const value = JSON.parse(await readFile(this.file(key), "utf8"));
        if (value.version !== 1) throw new Error("Unknown vault version");
        const decipher = createDecipheriv(
          "aes-256-gcm",
          await this.key(false),
          Buffer.from(value.nonce, "base64"),
        );
        decipher.setAAD(Buffer.from(key));
        decipher.setAuthTag(Buffer.from(value.tag, "base64"));
        return JSON.parse(
          Buffer.concat([
            decipher.update(Buffer.from(value.ciphertext, "base64")),
            decipher.final(),
          ]).toString("utf8"),
        );
      }
    } catch {}
    throw new AppError(
      "Credentials are unavailable. Re-enter credentials for this connection.",
    );
  }
  async delete(key: string) {
    this.memory.delete(key);
    if (this.directory) await rm(this.file(key), { force: true });
    if (this.persistent)
      try {
        const { AsyncEntry } = await import("@napi-rs/keyring");
        await new AsyncEntry("sdd-clinic", key).deleteCredential();
      } catch {}
  }
}
