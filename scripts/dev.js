import { spawn } from "node:child_process";
import net from "node:net";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const processDefinitions = [
  ["Backend", ["--prefix", "Backend", "run", "dev"]],
  ["Frontend", ["--prefix", "Frontend", "run", "dev", "--", "--host", "127.0.0.1"]]
];
const children = [];
let shuttingDown = false;
const backendPort = Number(process.env.PORT) || 3001;

const isPortOpen = (port) => new Promise((resolve) => {
  const socket = net.createConnection({ host: "127.0.0.1", port });
  const finish = (open) => {
    socket.destroy();
    resolve(open);
  };
  socket.once("connect", () => finish(true));
  socket.once("error", () => finish(false));
  socket.setTimeout(500, () => finish(false));
});

const isExistingMindScanApi = async () => {
  if (!(await isPortOpen(backendPort))) return false;
  try {
    const response = await fetch(`http://127.0.0.1:${backendPort}/api/health`, {
      signal: AbortSignal.timeout(1000)
    });
    const body = await response.json();
    return response.ok && body?.status === "healthy";
  } catch {
    return false;
  }
};

const stopChildren = (exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode == null && !child.killed) child.kill();
  }
  setTimeout(() => process.exit(exitCode), 250).unref();
};

const start = async () => {
  const backendAlreadyRunning = await isExistingMindScanApi();
  if (backendAlreadyRunning) {
    console.log(`MindScan API already healthy on port ${backendPort}; reusing it.`);
  } else if (await isPortOpen(backendPort)) {
    console.error(`Port ${backendPort} is already in use by a non-MindScan process. Stop that specific process or set PORT before running npm run dev.`);
    process.exitCode = 1;
    return;
  }

  const definitions = backendAlreadyRunning
    ? processDefinitions.filter(([label]) => label !== "Backend")
    : processDefinitions;
  for (const [label, args] of definitions) {
    const child = spawn(npmCommand, args, {
      stdio: "inherit",
      env: process.env,
      windowsHide: true,
      shell: process.platform === "win32"
    });
    children.push(child);
    child.on("error", (error) => {
      console.error(`${label} process failed to start: ${error.message}`);
      stopChildren(1);
    });
    child.on("exit", (code) => {
      if (!shuttingDown) {
        console.error(`${label} process exited${code == null ? "" : ` with code ${code}`}.`);
        stopChildren(code || 0);
      }
    });
  }
};

void start();

process.on("SIGINT", () => stopChildren(0));
process.on("SIGTERM", () => stopChildren(0));
