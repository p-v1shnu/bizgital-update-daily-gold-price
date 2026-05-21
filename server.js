const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;

loadEnvFile(path.join(ROOT, ".env"));

const ASSETS_DIR = path.join(ROOT, "assets");
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 3210);
const HOST = "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const WRITE_API_TOKEN = (process.env.WRITE_API_TOKEN || "").trim();

const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;
const MAX_LAYOUT_BYTES = 256 * 1024;
const FONT_EXTENSIONS = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const STATIC_FILES = new Map([
  ["/", path.join(ROOT, "index.html")],
  ["/app.js", path.join(ROOT, "app.js")],
  ["/styles.css", path.join(ROOT, "styles.css")],
]);

const TEMPLATE_MIME_TO_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

if (NODE_ENV === "production" && !WRITE_API_TOKEN) {
  console.error("WRITE_API_TOKEN is required when NODE_ENV=production");
  process.exit(1);
}

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const content = fs.readFileSync(envPath, "utf8");
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const normalizedLine = line.startsWith("export ") ? line.slice(7).trim() : line;
    const separatorIndex = normalizedLine.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      continue;
    }
    if (process.env[key] !== undefined) {
      continue;
    }

    let value = normalizedLine.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function json(res, status, value) {
  send(res, status, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify(value));
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const contentLengthHeader = req.headers["content-length"];
    if (contentLengthHeader) {
      const declaredLength = Number(contentLengthHeader);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        reject(createHttpError(413, "payload too large"));
        req.resume();
        return;
      }
    }

    const chunks = [];
    let total = 0;
    let done = false;

    function cleanup() {
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
    }

    function fail(error) {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      reject(error);
    }

    function succeed(value) {
      if (done) {
        return;
      }
      done = true;
      cleanup();
      resolve(value);
    }

    function onData(chunk) {
      total += chunk.length;
      if (total > maxBytes) {
        fail(createHttpError(413, "payload too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    }

    function onEnd() {
      succeed(Buffer.concat(chunks).toString("utf8"));
    }

    function onError(error) {
      fail(error);
    }

    function onAborted() {
      fail(createHttpError(400, "request aborted"));
    }

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  }[ext] || "application/octet-stream";
}

function getCurrentTemplatePath() {
  const candidates = [
    path.join(ASSETS_DIR, "template.png"),
    path.join(ASSETS_DIR, "template.jpg"),
    path.join(ASSETS_DIR, "template.jpeg"),
    path.join(ASSETS_DIR, "template.webp"),
    path.join(ROOT, "Template.png"),
    path.join(ROOT, "Template.jpg"),
    path.join(ROOT, "Template.jpeg"),
    path.join(ROOT, "Template.webp"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function getHeaderValue(value) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return typeof value === "string" ? value : "";
}

function getWriteToken(req) {
  const xWriteToken = getHeaderValue(req.headers["x-write-token"]).trim();
  if (xWriteToken) {
    return xWriteToken;
  }

  const authHeader = getHeaderValue(req.headers.authorization).trim();
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  return match ? match[1].trim() : "";
}

function requireWriteAccess(req, res) {
  if (!WRITE_API_TOKEN) {
    send(res, 503, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify({
      ok: false,
      error: "write api token is not configured",
    }));
    return false;
  }

  if (getWriteToken(req) !== WRITE_API_TOKEN) {
    send(res, 401, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify({
      ok: false,
      error: "unauthorized",
    }));
    return false;
  }

  return true;
}

async function readJsonBody(req, maxBytes) {
  const text = await readBody(req, maxBytes);
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw createHttpError(400, "invalid json");
  }
}

function validateLayoutPayload(payload) {
  return payload && typeof payload === "object" && !Array.isArray(payload);
}

function parseTemplatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "invalid payload");
  }

  if (typeof payload.dataUrl !== "string") {
    throw createHttpError(400, "invalid data url");
  }

  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/i.exec(payload.dataUrl);
  if (!match) {
    throw createHttpError(400, "invalid data url");
  }

  const mime = match[1].toLowerCase();
  const ext = TEMPLATE_MIME_TO_EXT[mime];
  if (!ext) {
    throw createHttpError(400, "unsupported image type");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (!buffer.length) {
    throw createHttpError(400, "invalid data url");
  }
  if (buffer.length > MAX_TEMPLATE_BYTES) {
    throw createHttpError(413, "payload too large");
  }

  return { ext, buffer };
}

function safeDecodePath(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch (_error) {
    return null;
  }
}

function hasDotSegment(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.some((segment) => segment.startsWith("."));
}

function resolveFontPath(pathname) {
  if (!pathname.startsWith("/assets/fonts/")) {
    return null;
  }

  const candidate = path.normalize(path.join(ROOT, pathname.slice(1)));
  const fontsRoot = path.join(ASSETS_DIR, "fonts");
  const relativeToFonts = path.relative(fontsRoot, candidate);
  if (relativeToFonts.startsWith("..") || path.isAbsolute(relativeToFonts)) {
    return null;
  }

  const ext = path.extname(candidate).toLowerCase();
  if (!FONT_EXTENSIONS.has(ext)) {
    return null;
  }
  if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
    return null;
  }

  return candidate;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/template") {
    const templatePath = getCurrentTemplatePath();
    if (!templatePath) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "template not found");
      return;
    }
    send(res, 200, { "Content-Type": contentType(templatePath) }, fs.readFileSync(templatePath));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/layout") {
    const layoutPath = path.join(DATA_DIR, "layout.json");
    if (!fs.existsSync(layoutPath)) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "layout not found");
      return;
    }
    send(res, 200, { "Content-Type": "application/json; charset=utf-8" }, fs.readFileSync(layoutPath));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layout") {
    if (!requireWriteAccess(req, res)) {
      return;
    }
    const body = await readJsonBody(req, MAX_LAYOUT_BYTES);
    if (!validateLayoutPayload(body)) {
      throw createHttpError(400, "invalid layout payload");
    }
    fs.writeFileSync(path.join(DATA_DIR, "layout.json"), JSON.stringify(body), "utf8");
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/default-layout") {
    const defaultLayoutPath = path.join(DATA_DIR, "default-layout.json");
    if (!fs.existsSync(defaultLayoutPath)) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "default layout not found");
      return;
    }
    send(res, 200, { "Content-Type": "application/json; charset=utf-8" }, fs.readFileSync(defaultLayoutPath));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/default-layout") {
    if (!requireWriteAccess(req, res)) {
      return;
    }
    const body = await readJsonBody(req, MAX_LAYOUT_BYTES);
    if (!validateLayoutPayload(body)) {
      throw createHttpError(400, "invalid layout payload");
    }
    fs.writeFileSync(path.join(DATA_DIR, "default-layout.json"), JSON.stringify(body), "utf8");
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/template") {
    if (!requireWriteAccess(req, res)) {
      return;
    }
    const payload = await readJsonBody(req, MAX_TEMPLATE_BYTES);
    const { ext, buffer } = parseTemplatePayload(payload);
    for (const oldName of ["template.png", "template.jpg", "template.jpeg", "template.webp"]) {
      const oldPath = path.join(ASSETS_DIR, oldName);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const outputPath = path.join(ASSETS_DIR, `template.${ext}`);
    fs.writeFileSync(outputPath, buffer);
    json(res, 200, { ok: true, path: outputPath });
    return;
  }

  send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
}

function serveStatic(req, res, url) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
    return;
  }

  const pathname = safeDecodePath(url.pathname);
  if (!pathname || !pathname.startsWith("/") || hasDotSegment(pathname)) {
    send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
    return;
  }

  const mappedFile = STATIC_FILES.get(pathname) || resolveFontPath(pathname);
  if (!mappedFile) {
    send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
    return;
  }

  if (!fs.existsSync(mappedFile) || fs.statSync(mappedFile).isDirectory()) {
    send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
    return;
  }

  const fileBody = fs.readFileSync(mappedFile);
  if (req.method === "HEAD") {
    send(res, 200, { "Content-Type": contentType(mappedFile) }, "");
    return;
  }

  send(res, 200, { "Content-Type": contentType(mappedFile) }, fileBody);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    serveStatic(req, res, url);
  } catch (error) {
    if (error && typeof error.status === "number") {
      send(res, error.status, { "Content-Type": "text/plain; charset=utf-8" }, error.message);
      return;
    }
    console.error("Unhandled server error:", error);
    send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "internal server error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Gold Price Poster Editor running on ${HOST}:${PORT}`);
});
