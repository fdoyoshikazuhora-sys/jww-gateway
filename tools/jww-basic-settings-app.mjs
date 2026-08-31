#!/usr/bin/env node
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultPath = "/apps/jww-basic-settings/";
const mimeTypes = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
});

function parseArgs(argv) {
  const options = { host: "127.0.0.1", port: 4178 };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--host") options.host = argv[++index] || options.host;
    else if (argument === "--port") options.port = Number(argv[++index]) || options.port;
  }
  return options;
}

function requestedFile(urlValue) {
  const pathname = decodeURIComponent(new URL(urlValue, "http://localhost").pathname);
  const relative = pathname.replace(/^\/+/, "");
  let candidate = path.resolve(repositoryRoot, relative || defaultPath.slice(1));
  if (!candidate.startsWith(`${repositoryRoot}${path.sep}`)) return null;
  if (existsSync(candidate) && statSync(candidate).isDirectory()) candidate = path.join(candidate, "index.html");
  return candidate;
}

export function createBasicSettingsAppServer() {
  return createServer((request, response) => {
    const file = requestedFile(request.url || defaultPath);
    if (!file || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
      response.end("Not found\n");
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
      "Cross-Origin-Opener-Policy": "same-origin",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(file).pipe(response);
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const server = createBasicSettingsAppServer();
  server.listen(options.port, options.host, () => {
    console.log(`JWW Basic Settings: http://${options.host}:${options.port}${defaultPath}`);
  console.log("Local static server. Press Ctrl+C to stop.");
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exitCode = 1;
  });
}
