const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;

// --- loadEnvFile defined first so it can be called immediately below ---

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
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      // Strip inline comments from unquoted values: KEY=value # comment → value
      value = value.replace(/\s+#.*$/, "").trim();
    }

    process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env"));

const ASSETS_DIR = path.join(ROOT, "assets");
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 3210);
const HOST = process.env.HOST || "127.0.0.1";
const NODE_ENV = process.env.NODE_ENV || "development";
const WRITE_API_TOKEN = (process.env.WRITE_API_TOKEN || "").trim();
const WP_WEBHOOK_URL_RAW = (process.env.WP_WEBHOOK_URL || "").trim();
const WP_WEBHOOK_SECRET = (process.env.WP_WEBHOOK_SECRET || "").trim();
const WEBHOOK_TIMEOUT_MS = Number(process.env.WP_WEBHOOK_TIMEOUT_MS || 8000);

const MAX_TEMPLATE_BYTES = 10 * 1024 * 1024;
const MAX_LAYOUT_BYTES = 256 * 1024;
const MAX_PUBLISH_BYTES = 64 * 1024;
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

// --- Startup validation ---

if (NODE_ENV === "production" && !WRITE_API_TOKEN) {
  console.error("WRITE_API_TOKEN is required when NODE_ENV=production");
  process.exit(1);
}

let WP_WEBHOOK_URL = WP_WEBHOOK_URL_RAW;
if (WP_WEBHOOK_URL_RAW) {
  try {
    const parsed = new URL(WP_WEBHOOK_URL_RAW);
    if (NODE_ENV === "production" && parsed.protocol !== "https:") {
      console.error("WP_WEBHOOK_URL must use https:// in production");
      process.exit(1);
    }
  } catch {
    console.error("WP_WEBHOOK_URL is not a valid URL");
    process.exit(1);
  }
}

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

// --- Template in-memory cache (invalidated on upload) ---

let templateCache = null; // { data: Buffer, mime: string } | null

function getCachedTemplate() {
  if (templateCache) return templateCache;
  const p = getCurrentTemplatePath();
  if (!p) return null;
  try {
    templateCache = { data: fs.readFileSync(p), mime: contentType(p) };
  } catch {
    templateCache = null;
  }
  return templateCache;
}

function invalidateTemplateCache() {
  templateCache = null;
}

// --- HTTP helpers ---

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

function addSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
}

function readBody(req, maxBytes, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const contentLengthHeader = req.headers["content-length"];
    if (contentLengthHeader) {
      const declaredLength = Number(contentLengthHeader);
      if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
        reject(createHttpError(413, "payload too large"));
        req.destroy();
        return;
      }
    }

    const chunks = [];
    let total = 0;
    let done = false;

    const timer = setTimeout(() => {
      fail(createHttpError(408, "request timeout"));
      req.destroy();
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
    }

    function fail(error) {
      if (done) return;
      done = true;
      cleanup();
      reject(error);
    }

    function succeed(value) {
      if (done) return;
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

// Constant-time string comparison via HMAC to prevent timing side-channel attacks
function timingSafeStringEqual(a, b) {
  const key = crypto.randomBytes(32);
  const ha = crypto.createHmac("sha256", key).update(String(a)).digest();
  const hb = crypto.createHmac("sha256", key).update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireWriteAccess(req, res) {
  if (!WRITE_API_TOKEN) {
    send(res, 503, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify({
      ok: false,
      error: "write api token is not configured",
    }));
    return false;
  }

  const provided = getWriteToken(req);
  if (!timingSafeStringEqual(provided, WRITE_API_TOKEN)) {
    send(res, 401, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify({
      ok: false,
      error: "unauthorized",
    }));
    return false;
  }

  return true;
}

async function readJsonBody(req, maxBytes, timeoutMs) {
  const text = await readBody(req, maxBytes, timeoutMs);
  try {
    return JSON.parse(text);
  } catch (_error) {
    throw createHttpError(400, "invalid json");
  }
}

function validateLayoutPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  if (!payload.dateStrip || typeof payload.dateStrip !== "object" || Array.isArray(payload.dateStrip)) return false;
  const strip = payload.dateStrip;
  for (const key of ["x", "y", "width", "height", "textX", "textY"]) {
    if (typeof strip[key] !== "number" || !Number.isFinite(strip[key])) return false;
  }
  if (!Array.isArray(payload.slots)) return false;
  for (const slot of payload.slots) {
    if (!slot || typeof slot !== "object" || Array.isArray(slot)) return false;
    for (const key of ["x", "y", "width", "height", "textX", "textY"]) {
      if (typeof slot[key] !== "number" || !Number.isFinite(slot[key])) return false;
    }
    if (typeof slot.valueField !== "string") return false;
  }
  return true;
}

function normalizePriceValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }
  if (typeof value !== "string") {
    return null;
  }
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return null;
  }
  return Number(digits);
}

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function parsePublishPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "invalid payload");
  }
  const date = typeof payload.date === "string" ? payload.date.trim() : "";
  const time = typeof payload.time === "string" ? payload.time.trim() : "";
  if (!date || !time) {
    throw createHttpError(400, "date/time is required");
  }
  if (!DATE_RE.test(date)) {
    throw createHttpError(400, "invalid date format (expected DD/MM/YYYY)");
  }
  if (!TIME_RE.test(time)) {
    throw createHttpError(400, "invalid time format (expected HH:MM)");
  }

  const keyMap = {
    bar_sell_one_baht: ["barSellOneBaht"],
    bar_buy_one_baht: ["barBuyOneBaht"],
    print_sell_one_baht: ["printSellOneBaht"],
    print_buy_one_baht: ["printBuyOneBaht"],
    print_sell_one_salueng: ["printSellOneSalueng"],
    print_buy_one_salueng: ["printBuyOneSalueng"],
    print_sell_five_houn: ["printSellFiveHoun", "printSellFiveTamlueng"],
    print_buy_five_houn: ["printBuyFiveHoun", "printBuyFiveTamlueng"],
  };

  const values = {};
  for (const [targetKey, inputKeys] of Object.entries(keyMap)) {
    const sourceKey = inputKeys.find((key) => payload[key] !== undefined);
    const normalized = normalizePriceValue(sourceKey ? payload[sourceKey] : undefined);
    if (normalized === null || normalized <= 0) {
      throw createHttpError(400, `invalid value: ${inputKeys[0]}`);
    }
    values[targetKey] = normalized;
  }

  return {
    source: "bizgital-update-daily-gold-price",
    sent_at: new Date().toISOString(),
    date,
    time,
    values,
  };
}

async function publishToWordpress(payload) {
  if (!WP_WEBHOOK_URL || !WP_WEBHOOK_SECRET) {
    throw createHttpError(503, "wordpress webhook is not configured");
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", WP_WEBHOOK_SECRET)
    .update(`${timestamp}.${body}`, "utf8")
    .digest("hex");

  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), Math.max(2000, WEBHOOK_TIMEOUT_MS));
  try {
    const response = await fetch(WP_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "X-Bizgital-Timestamp": timestamp,
        "X-Bizgital-Signature": `sha256=${signature}`,
      },
      body,
      signal: abortController.signal,
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw createHttpError(502, `wordpress webhook failed (${response.status})`);
    }

    return {
      ok: true,
      status: response.status,
      body: responseText.slice(0, 300),
    };
  } catch (error) {
    if (error.name === "AbortError") {
      throw createHttpError(504, "wordpress webhook timed out");
    }
    if (error.status) {
      throw error;
    }
    throw createHttpError(502, "wordpress webhook unreachable");
  } finally {
    clearTimeout(timer);
  }
}

function parseTemplatePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createHttpError(400, "invalid payload");
  }

  if (typeof payload.dataUrl !== "string") {
    throw createHttpError(400, "invalid data url");
  }

  // Match only the data URL header — avoid scanning the full base64 string with a regex
  const headerMatch = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/.exec(payload.dataUrl);
  if (!headerMatch) {
    throw createHttpError(400, "invalid data url");
  }

  const mime = headerMatch[1].toLowerCase();
  const ext = TEMPLATE_MIME_TO_EXT[mime];
  if (!ext) {
    throw createHttpError(400, "unsupported image type");
  }

  // Check approximate decoded size before allocating the buffer (~3/4 of base64 length)
  const b64 = payload.dataUrl.slice(headerMatch[0].length);
  if (b64.length > Math.ceil(MAX_TEMPLATE_BYTES * 4 / 3) + 4) {
    throw createHttpError(413, "payload too large");
  }

  const buffer = Buffer.from(b64, "base64");
  if (!buffer.length) {
    throw createHttpError(400, "invalid data url");
  }
  if (buffer.length > MAX_TEMPLATE_BYTES) {
    throw createHttpError(413, "payload too large");
  }

  return { ext, buffer };
}

function safeDecodePath(pathname) {
  // Reject double-encoded sequences before decoding to prevent bypass attempts
  if (/%25/i.test(pathname)) return null;
  try {
    return decodeURIComponent(pathname);
  } catch (_error) {
    return null;
  }
}

function hasDotSegment(pathname) {
  // Normalize Windows-style backslashes before splitting
  const normalized = pathname.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments.some((segment) => segment === "." || segment === ".." || segment.startsWith("."));
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
  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, uptime: process.uptime() });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/template") {
    const tmpl = getCachedTemplate();
    if (!tmpl) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "template not found");
      return;
    }
    send(res, 200, { "Content-Type": tmpl.mime, "Cache-Control": "no-store" }, tmpl.data);
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/layout") {
    const layoutPath = path.join(DATA_DIR, "layout.json");
    if (!fs.existsSync(layoutPath)) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, "layout not found");
      return;
    }
    send(res, 200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, fs.readFileSync(layoutPath));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/layout") {
    if (!requireWriteAccess(req, res)) {
      return;
    }
    const body = await readJsonBody(req, MAX_LAYOUT_BYTES, 10_000);
    if (!validateLayoutPayload(body)) {
      throw createHttpError(400, "invalid layout payload");
    }
    await fs.promises.writeFile(path.join(DATA_DIR, "layout.json"), JSON.stringify(body), "utf8");
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/default-layout") {
    const defaultLayoutPath = path.join(DATA_DIR, "default-layout.json");
    if (!fs.existsSync(defaultLayoutPath)) {
      send(res, 404, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, "default layout not found");
      return;
    }
    send(res, 200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, fs.readFileSync(defaultLayoutPath));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/default-layout") {
    if (!requireWriteAccess(req, res)) {
      return;
    }
    const body = await readJsonBody(req, MAX_LAYOUT_BYTES, 10_000);
    if (!validateLayoutPayload(body)) {
      throw createHttpError(400, "invalid layout payload");
    }
    await fs.promises.writeFile(path.join(DATA_DIR, "default-layout.json"), JSON.stringify(body), "utf8");
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/template") {
    if (!requireWriteAccess(req, res)) {
      return;
    }
    const payload = await readJsonBody(req, MAX_TEMPLATE_BYTES, 60_000);
    const { ext, buffer } = parseTemplatePayload(payload);

    // Atomic write: write to a temp file first, then rename to avoid a window with no template
    const tmpPath = path.join(ASSETS_DIR, "template_upload.tmp");
    await fs.promises.writeFile(tmpPath, buffer);

    for (const oldName of ["template.png", "template.jpg", "template.jpeg", "template.webp"]) {
      await fs.promises.unlink(path.join(ASSETS_DIR, oldName)).catch(() => {});
    }

    await fs.promises.rename(tmpPath, path.join(ASSETS_DIR, `template.${ext}`));
    invalidateTemplateCache();

    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/publish-wordpress") {
    if (!requireWriteAccess(req, res)) {
      return;
    }
    const inputPayload = await readJsonBody(req, MAX_PUBLISH_BYTES, 10_000);
    const publishPayload = parsePublishPayload(inputPayload);
    const publishResult = await publishToWordpress(publishPayload);
    json(res, 200, publishResult);
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

  let stat;
  try {
    stat = fs.statSync(mappedFile);
  } catch {
    send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
    return;
  }

  if (stat.isDirectory()) {
    send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
    return;
  }

  if (req.method === "HEAD") {
    send(res, 200, { "Content-Type": contentType(mappedFile) }, "");
    return;
  }

  let fileBody;
  try {
    fileBody = fs.readFileSync(mappedFile);
  } catch {
    send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "internal server error");
    return;
  }

  send(res, 200, { "Content-Type": contentType(mappedFile) }, fileBody);
}

let isShuttingDown = false;

const server = http.createServer(async (req, res) => {
  if (isShuttingDown) {
    send(res, 503, { "Content-Type": "text/plain; charset=utf-8", "Connection": "close" }, "server shutting down");
    return;
  }

  addSecurityHeaders(res);

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/health" || url.pathname.startsWith("/api/")) {
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

server.setTimeout(30_000);
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;

server.listen(PORT, HOST, () => {
  console.log(`Gold Price Poster Editor running on ${HOST}:${PORT}`);
});

function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`${signal} received — closing server`);
  server.close(() => {
    console.log("Server closed cleanly");
    process.exit(0);
  });
  setTimeout(() => {
    console.error("Forced exit after timeout");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
