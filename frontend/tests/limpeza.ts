import type { Reporter } from "@playwright/test/reporter";
import { lstat, rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { tmpdir } from "node:os";

export default class LimpezaDoEnsaio implements Reporter {
  constructor(private readonly options: { pasta: string }) {}
  async onExit() {
    const pasta = resolve(this.options.pasta);
    if (
      dirname(pasta) !== resolve(tmpdir()) ||
      !/^siproquim-ui-test-[0-9a-f-]{36}$/.test(basename(pasta))
    )
      throw Error("Pasta temporária de teste inválida.");
    const item = await lstat(pasta).catch((e) => {
      if (e.code === "ENOENT") return;
      throw e;
    });
    if (!item) return;
    if (!item.isDirectory() || item.isSymbolicLink())
      throw Error("A pasta de teste mudou de tipo.");
    await rm(pasta, {
      recursive: true,
      force: true,
      maxRetries: 6,
      retryDelay: 200,
    });
  }
}
