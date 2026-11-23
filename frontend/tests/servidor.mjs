import { spawn } from "node:child_process";
import { mkdir, mkdtemp, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
const frontend = fileURLToPath(new URL("../", import.meta.url)),
  root = resolve(frontend, "..");
const temp =
  process.env.SIPROQUIM_UI_PASTA ||
  (await mkdtemp(join(tmpdir(), "siproquim-ui-test-")));
if (process.env.SIPROQUIM_UI_PASTA) await mkdir(temp);
const jar = join(temp, "backend.jar");
await copyFile(resolve(root, "backend/java/target/siproquim-backend.jar"), jar);
const reserva = createServer();
await new Promise((ok, falha) => reserva.once("error", falha).listen(0, "127.0.0.1", ok));
const porta = reserva.address().port;
await new Promise((ok) => reserva.close(ok));
const env = {
  ...process.env,
  SIPROQUIM_DOWNLOADS: join(temp, "Downloads"),
  SIPROQUIM_DADOS: join(temp, "real"),
  SIPROQUIM_PORTA: String(porta),
  SIPROQUIM_PYTHON:
    process.env.SIPROQUIM_PYTHON ||
    resolve(
      root,
      process.platform === "win32"
        ? "backend/python/.venv/Scripts/python.exe"
        : "backend/python/.venv/bin/python",
    ),
  SIPROQUIM_EXTRATOR: resolve(root, "backend/python/extrair.py"),
};
delete env.SIPROQUIM_TOKEN;
const children = [];
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill();
  for (
    let i = 0;
    i < 50 &&
    children.some((c) => c.exitCode === null && c.signalCode === null);
    i++
  )
    await delay(100);
  await rm(temp, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
try {
  const service = spawn("java", ["-jar", jar], {
    env,
    stdio: "ignore",
    windowsHide: true,
  });
  children.push(service);
  for (let n = 0; n < 120; n++) {
    if (service.exitCode !== null)
      throw Error("Falha ao iniciar backend de teste.");
    try {
      if (
        (await fetch("http://127.0.0.1:" + env.SIPROQUIM_PORTA + "/api/saude"))
          .ok
      )
        break;
    } catch {}
    await delay(200);
    if (n === 119) throw Error("Tempo de inicialização excedido.");
  }
  const vite = spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--port", "15173"],
    { cwd: frontend, env, stdio: "inherit", windowsHide: true },
  );
  children.push(vite);
  vite.once("exit", () => {
    if (!closing) void stop();
  });
} catch (e) {
  console.error(e);
  await stop();
}
