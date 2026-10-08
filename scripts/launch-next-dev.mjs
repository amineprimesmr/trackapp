#!/usr/bin/env node
/**
 * Lance `next dev` avec un Node compatible.
 *
 * Pourquoi ce wrapper :
 * - Node 24 (current) a une régression d'IPC avec `child_process.fork()` qui
 *   fait que le worker Next reste figé à 0 % CPU et n'ouvre jamais le port.
 *   Cf. fichier `node_modules/next/dist/server/lib/start-server.js` (process.send IPC).
 * - Avec Node 22 LTS, le fork fonctionne et le port 3000 répond immédiatement.
 *
 * Stratégie :
 * - Si Node ≥ 24, on tente Node 22 LTS Homebrew (`/opt/homebrew/opt/node@22/bin/node`)
 *   ou un fallback (`/usr/local/opt/node@22/bin/node`).
 * - Sinon on garde le Node courant (process.execPath).
 * - On libère ensuite le port et on spawn `next dev`.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const HOMEBREW_NODE22_CANDIDATES = [
  "/opt/homebrew/opt/node@22/bin/node",
  "/usr/local/opt/node@22/bin/node",
];

function pickNodeBin() {
  const currentMajor = Number(process.versions.node.split(".")[0]);
  if (currentMajor <= 22) return process.execPath;
  for (const candidate of HOMEBREW_NODE22_CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  console.warn(
    `[launch-next-dev] Node ${process.versions.node} détecté. Next.js peut rester figé. ` +
      `Installe Node 22 LTS (\`brew install node@22\`) ou utilise nvm.`,
  );
  return process.execPath;
}

const nodeBin = pickNodeBin();

function resolveDevPort() {
  const fromEnv = process.env.TRACKAPP_DEV_PORT?.trim();
  if (fromEnv && /^\d{2,5}$/.test(fromEnv)) return fromEnv;
  const argv = process.argv.slice(2);
  const flagIdx = argv.findIndex((a) => a === "-p" || a === "--port");
  if (flagIdx >= 0 && argv[flagIdx + 1] && /^\d{2,5}$/.test(String(argv[flagIdx + 1]))) {
    return String(argv[flagIdx + 1]);
  }
  return "3000";
}

const devPort = resolveDevPort();
const nextExtraArgs = process.argv.slice(2).filter((arg, i, arr) => {
  if (arg === "-p" || arg === "--port") return false;
  if (i > 0 && (arr[i - 1] === "-p" || arr[i - 1] === "--port")) return false;
  return true;
});

const freePortRes = spawnSync(nodeBin, [path.join(__dirname, "free-port.mjs"), devPort], {
  cwd: root,
  stdio: "inherit",
});
if (freePortRes.status !== 0) {
  process.exit(freePortRes.status ?? 1);
}

const args = [
  path.join(root, "node_modules/next/dist/bin/next"),
  "dev",
  "--hostname",
  "127.0.0.1",
  "-p",
  devPort,
  ...nextExtraArgs,
];

console.log(
  `[launch-next-dev] using ${nodeBin} (node ${spawnSync(nodeBin, ["-v"], { encoding: "utf8" }).stdout.trim()}) → http://127.0.0.1:${devPort}`,
);

const localAppUrl = `http://127.0.0.1:${devPort}`;

const child = spawn(nodeBin, args, {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    FORCE_COLOR: "1",
    TRACKAPP_DEV_PORT: devPort,
    // Évite redirect post-login vers :3000 (autre projet) quand Trackapp est sur un autre port
    NEXT_PUBLIC_APP_URL: localAppUrl,
  },
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
