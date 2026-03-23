const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const ASSETS_DIR = path.join(ROOT, "assets");
const DATA_DIR = path.join(ROOT, "data");
const PORT = 3210;

fs.mkdirSync(ASSETS_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function json(res, status, value) {
  send(res, status, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
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
    const body = await readBody(req);
    fs.writeFileSync(path.join(DATA_DIR, "layout.json"), body, "utf8");
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
    const body = await readBody(req);
    fs.writeFileSync(path.join(DATA_DIR, "default-layout.json"), body, "utf8");
    json(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/template") {
    const body = JSON.parse(await readBody(req));
    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(body.dataUrl || "");
    if (!match) {
      json(res, 400, { ok: false, error: "invalid data url" });
      return;
    }

    const mime = match[1];
    const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
    for (const oldName of ["template.png", "template.jpg", "template.jpeg", "template.webp"]) {
      const oldPath = path.join(ASSETS_DIR, oldName);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    const outputPath = path.join(ASSETS_DIR, `template.${ext}`);
    fs.writeFileSync(outputPath, Buffer.from(match[2], "base64"));
    json(res, 200, { ok: true, path: outputPath });
    return;
  }

  send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
}

function serveStatic(req, res, url) {
  let filePath = url.pathname === "/" ? path.join(ROOT, "index.html") : path.join(ROOT, decodeURIComponent(url.pathname));
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "not found");
    return;
  }

  send(res, 200, { "Content-Type": contentType(filePath) }, fs.readFileSync(filePath));
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
    send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, error.stack || String(error));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Gold Price Poster Editor running at http://127.0.0.1:${PORT}`);
});
