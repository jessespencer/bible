// The whole family on one port, laid out as in production: http://localhost:5170/bible/<app>/.
// Starts each app's own Vite server (on its pinned port from bible-ui's APPS) and proxies to it,
// HMR websockets included. One origin means the apps share storage, so Night or Day, the
// translation and Atlas's data paths behave as they do live. An app already running is reused.

import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { APPS } from "../packages/bible-ui/src/apps.ts";

const PORT = 5170;
const HOST = "localhost";

const appFor = (url = "/") => APPS.find((app) => url === app.path.slice(0, -1) || url.startsWith(app.path));

const portInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.connect(port, HOST);
    socket.once("connect", () => (socket.destroy(), resolve(true)));
    socket.once("error", () => resolve(false));
  });

// ─── The apps' own servers ──────────────────────────────────────

const children = [];
const width = Math.max(...APPS.map((app) => app.id.length));

for (const app of APPS) {
  if (await portInUse(app.devPort)) {
    console.log(`${app.id.padEnd(width)} │ already running on ${app.devPort}, reusing it`);
    continue;
  }
  const child = spawn("pnpm", ["--filter", app.id, "dev"], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  const prefix = (stream, out) => {
    let rest = "";
    stream.on("data", (chunk) => {
      const lines = (rest + chunk).split("\n");
      rest = lines.pop();
      for (const line of lines) if (line.trim()) out.write(`${app.id.padEnd(width)} │ ${line}\n`);
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on("exit", (code) => code && console.error(`${app.id.padEnd(width)} │ exited with ${code}`));
  children.push(child);
}

const stop = () => {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// ─── One front door ─────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const app = appFor(req.url);
  if (!app) {
    // As pages/index.html does in production: the root opens Atlas, keeping the query.
    const query = req.url?.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
    if (req.url === "/" || req.url?.startsWith("/?") || req.url?.startsWith("/bible")) {
      res.writeHead(302, { location: `${APPS[0].path}${query}` }).end();
    } else {
      res.writeHead(404, { "content-type": "text/plain" }).end("Not part of the bible apps.\n");
    }
    return;
  }
  const upstream = http.request(
    { host: HOST, port: app.devPort, path: req.url, method: req.method, headers: req.headers },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers);
      response.pipe(res);
    },
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
    res.end(`${app.label} isn't up yet on ${app.devPort}. Reload in a moment.\n`);
  });
  req.pipe(upstream);
});

// HMR: hand the websocket straight through to the app's server.
server.on("upgrade", (req, socket, head) => {
  const app = appFor(req.url);
  if (!app) return socket.destroy();
  const upstream = net.connect(app.devPort, HOST, () => {
    const headers = Object.entries(req.headers).map(([key, value]) => `${key}: ${value}`).join("\r\n");
    upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n${headers}\r\n\r\n`);
    if (head.length) upstream.write(head);
    upstream.pipe(socket).pipe(upstream);
  });
  upstream.on("error", () => socket.destroy());
  socket.on("error", () => upstream.destroy());
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") console.error(`\nPort ${PORT} is taken: pnpm dev may already be running at http://${HOST}:${PORT}${APPS[0].path}`);
  else console.error(error);
  stop();
});

server.listen(PORT, HOST, () => {
  console.log(`\nAll apps on one port: http://${HOST}:${PORT}${APPS[0].path}`);
  for (const app of APPS) console.log(`  ${app.label.padEnd(12)} http://${HOST}:${PORT}${app.path}`);
  console.log("");
});
