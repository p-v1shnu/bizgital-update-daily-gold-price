const canvas = document.getElementById("posterCanvas");
const ctx = canvas.getContext("2d");
const previewCanvas = document.getElementById("previewCanvas");
const previewCtx = previewCanvas.getContext("2d");
const previewOverlay = document.getElementById("previewOverlay");
const previewStage = document.getElementById("previewStage");

const LAO_FONT_FAMILY = "'Noto Sans Lao Local', 'Noto Sans Lao', sans-serif";
const LEGACY_VALUE_FIELD_MAP = {
  printSellFiveTamlueng: "printSellFiveHoun",
  printBuyFiveTamlueng: "printBuyFiveHoun",
};

function normalizeValueFieldName(valueField) {
  return LEGACY_VALUE_FIELD_MAP[valueField] || valueField;
}

function findSlotByValueField(slots, targetValueField) {
  const normalizedTarget = normalizeValueFieldName(targetValueField);
  return slots.find((slot) => normalizeValueFieldName(slot.valueField) === normalizedTarget);
}

const DEFAULT_LAYOUT = {
  dateStrip: { x: 106, y: 252, width: 590, height: 72, textX: 400, textY: 310 },
  slots: [
    { x: 151, y: 529, width: 302, height: 66, textX: 302, textY: 580, valueField: "barSellOneBaht", label: "ຄຳແທ່ງ ລາຄາຂາຍ" },
    { x: 470, y: 529, width: 303, height: 66, textX: 622, textY: 580, valueField: "barBuyOneBaht", label: "ຄຳແທ່ງ ລາຄາຊື້" },
    { x: 151, y: 799, width: 302, height: 66, textX: 302, textY: 850, valueField: "printSellOneBaht", label: "ຮູບພິມ 1 ບາດ ລາຄາຂາຍ" },
    { x: 470, y: 799, width: 303, height: 66, textX: 622, textY: 850, valueField: "printBuyOneBaht", label: "ຮູບພິມ 1 ບາດ ລາຄາຊື້" },
    { x: 151, y: 918, width: 302, height: 66, textX: 302, textY: 948, valueField: "printSellOneSalueng", label: "1 ສະຫຼຶງ ລາຄາຂາຍ" },
    { x: 470, y: 918, width: 303, height: 66, textX: 622, textY: 948, valueField: "printBuyOneSalueng", label: "1 ສະຫຼຶງ ລາຄາຊື້" },
    { x: 151, y: 1039, width: 302, height: 66, textX: 302, textY: 1089, valueField: "printSellFiveHoun", label: "5 ຫຸນ ລາຄາຂາຍ" },
    { x: 470, y: 1039, width: 303, height: 66, textX: 622, textY: 1089, valueField: "printBuyFiveHoun", label: "5 ຫຸນ ລາຄາຊື້" },
  ],
};

const fields = {
  date: document.getElementById("dateInput"),
  time: document.getElementById("timeInput"),
  barSellOneBaht: document.getElementById("barSellOneBaht"),
  barBuyOneBaht: document.getElementById("barBuyOneBaht"),
  printSellOneBaht: document.getElementById("printSellOneBaht"),
  printBuyOneBaht: document.getElementById("printBuyOneBaht"),
  printSellOneSalueng: document.getElementById("printSellOneSalueng"),
  printBuyOneSalueng: document.getElementById("printBuyOneSalueng"),
  printSellFiveHoun: document.getElementById("printSellFiveHoun"),
  printBuyFiveHoun: document.getElementById("printBuyFiveHoun"),
};

const uploadTemplateButton = document.getElementById("uploadTemplateButton");
const templateFileInput = document.getElementById("templateFileInput");
const saveLayoutButton = document.getElementById("saveLayoutButton");
const saveDefaultButton = document.getElementById("saveDefaultButton");
const resetLayoutButton = document.getElementById("resetLayoutButton");
const openDisplayButton = document.getElementById("openDisplayButton");
const updateDisplayButton = document.getElementById("updateDisplayButton");
const publishWordpressButton = document.getElementById("publishWordpressButton");
const exportButton = document.getElementById("exportButton");
const statusText = document.getElementById("statusText");
const writeApiTokenInput = document.getElementById("writeApiTokenInput");
const writeApiTokenField = document.getElementById("writeApiTokenField");

const LOCAL_TOKEN_STORAGE_KEY = "gold_price_write_api_token";

let builtInTemplate = null;
let layout = structuredClone(DEFAULT_LAYOUT);
let defaultLayout = structuredClone(DEFAULT_LAYOUT);
let dragState = null;
let dragRaf = null;
let resizeRaf = null;

function getWriteApiToken() {
  return (writeApiTokenInput?.value || "").trim();
}

function getJsonHeadersWithOptionalWriteToken() {
  const headers = { "Content-Type": "application/json" };
  const token = getWriteApiToken();
  if (token) {
    headers["X-Write-Token"] = token;
  }
  return headers;
}

async function loadPublicConfig() {
  try {
    const response = await fetch("/api/public-config", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch (_error) {
    return null;
  }
}

async function ensureLaoFontsLoaded() {
  if (!document.fonts) {
    return;
  }

  await Promise.all([
    document.fonts.load(`400 18px ${LAO_FONT_FAMILY}`, "ທົດສອບ"),
    document.fonts.load(`700 32px ${LAO_FONT_FAMILY}`, "ທົດສອບ"),
    document.fonts.ready,
  ]);
}

function pad2(value) {
  return String(value).padStart(2, "0");
}

function initializeDateTimeInputs() {
  const now = new Date();
  fields.date.value = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  fields.time.value = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
}

function formatNumberInput(value) {
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) {
    return "";
  }

  return Number(digits).toLocaleString("en-US");
}

function getPosterData() {
  const rawDate = fields.date.value.trim();
  const formattedDate = rawDate
    ? (() => {
        const [year, month, day] = rawDate.split("-");
        return `${day}/${month}/${year}`;
      })()
    : "";

  return {
    date: formattedDate,
    time: fields.time.value.trim() || "",
    barSellOneBaht: fields.barSellOneBaht.value.trim() || "",
    barBuyOneBaht: fields.barBuyOneBaht.value.trim() || "",
    printSellOneBaht: fields.printSellOneBaht.value.trim() || "",
    printBuyOneBaht: fields.printBuyOneBaht.value.trim() || "",
    printSellOneSalueng: fields.printSellOneSalueng.value.trim() || "",
    printBuyOneSalueng: fields.printBuyOneSalueng.value.trim() || "",
    printSellFiveHoun: fields.printSellFiveHoun.value.trim() || "",
    printBuyFiveHoun: fields.printBuyFiveHoun.value.trim() || "",
  };
}

function drawText(targetCtx, text, x, y, options = {}) {
  const {
    font = `700 30px ${LAO_FONT_FAMILY}`,
    color = "#5d3608",
    align = "center",
    baseline = "alphabetic",
    shadow = false,
  } = options;

  targetCtx.save();
  targetCtx.font = font;
  targetCtx.fillStyle = color;
  targetCtx.textAlign = align;
  targetCtx.textBaseline = baseline;

  if (shadow) {
    targetCtx.shadowColor = "rgba(255,255,255,0.45)";
    targetCtx.shadowBlur = 10;
    targetCtx.shadowOffsetY = 2;
  }

  targetCtx.fillText(text, x, y);
  targetCtx.restore();
}

function fitFontSize(targetCtx, text, maxWidth, baseFontSize, fontFamily, fontWeight = "700") {
  const originalFont = targetCtx.font;
  let size = baseFontSize;
  while (size > 20) {
    targetCtx.font = `${fontWeight} ${size}px ${fontFamily}`;
    if (targetCtx.measureText(text).width <= maxWidth) {
      break;
    }
    size -= 1;
  }
  targetCtx.font = originalFont;
  return Math.max(size, 20);
}

function getDateDisplayText(data) {
  if (!data.date && !data.time) {
    return "";
  }
  return `ວັນທີ: ${data.date}  ເວລາ: ${data.time} ໂມງ`;
}

function getSlotDisplayText(slot, data) {
  const value = data[slot.valueField];
  return value ? `${value} ກີບ` : "";
}

function getDateTextSpec(data) {
  return {
    key: "date",
    text: getDateDisplayText(data),
    x: layout.dateStrip.textX,
    y: layout.dateStrip.textY,
    boxX: layout.dateStrip.x,
    boxY: layout.dateStrip.y,
    boxWidth: layout.dateStrip.width,
    boxHeight: layout.dateStrip.height,
    fontSize: 28,
    font: `700 28px ${LAO_FONT_FAMILY}`,
    color: "#fff6e0",
    shadow: true,
  };
}

function getSlotTextSpec(slot, data, targetCtx = ctx) {
  const text = getSlotDisplayText(slot, data);
  const fontSize = fitFontSize(targetCtx, text || " ", slot.width - 26, 31, LAO_FONT_FAMILY);
  return {
    key: slot.valueField,
    text,
    x: slot.textX,
    y: slot.textY,
    boxX: slot.x,
    boxY: slot.y,
    boxWidth: slot.width,
    boxHeight: slot.height,
    fontSize,
    font: `700 ${fontSize}px ${LAO_FONT_FAMILY}`,
    color: "#8d5811",
    shadow: false,
  };
}

function getAllTextSpecs(data, targetCtx = ctx) {
  return [
    getDateTextSpec(data),
    ...layout.slots.map((slot) => getSlotTextSpec(slot, data, targetCtx)),
  ];
}

function drawOverlayValues(targetCtx, data) {
  const textSpecs = getAllTextSpecs(data, targetCtx);
  textSpecs.forEach((spec) => {
    if (!spec.text) {
      return;
    }
    drawText(targetCtx, spec.text, spec.x, spec.y, {
      font: spec.font,
      color: spec.color,
      shadow: spec.shadow,
    });
  });
}

function drawPosterTo(targetCtx) {
  const data = getPosterData();
  const w = targetCtx.canvas.width;
  const h = targetCtx.canvas.height;
  targetCtx.clearRect(0, 0, w, h);

  if (!builtInTemplate) {
    return;
  }

  targetCtx.drawImage(builtInTemplate, 0, 0, w, h);
  drawOverlayValues(targetCtx, data);
}

function updatePreviewHandles() {
  const scale = getPreviewScale();
  const data = getPosterData();
  previewOverlay.replaceChildren();
  const textSpecs = getAllTextSpecs(data, previewCtx);
  const handles = [
    {
      key: "date",
      label: "ວັນທີ / ເວລາ",
      x: layout.dateStrip.x,
      y: layout.dateStrip.y,
      width: layout.dateStrip.width,
      height: layout.dateStrip.height,
      textSpec: textSpecs.find((item) => item.key === "date"),
    },
    ...layout.slots.map((slot) => ({
      key: slot.valueField,
      label: slot.label,
      x: slot.x,
      y: slot.y,
      width: slot.width,
      height: slot.height,
      textSpec: textSpecs.find((item) => item.key === slot.valueField),
    })),
  ];

  const overlayWidth = previewCanvas.clientWidth;
  const overlayHeight = previewCanvas.clientHeight;
  previewOverlay.style.width = `${overlayWidth}px`;
  previewOverlay.style.height = `${overlayHeight}px`;
  previewOverlay.style.left = `${previewCanvas.offsetLeft}px`;
  previewOverlay.style.top = `${previewCanvas.offsetTop}px`;

  handles.forEach((handle) => {
    const wrapper = document.createElement("button");
    wrapper.type = "button";
    wrapper.className = "drag-handle";
    if (dragState?.key === handle.key) {
      wrapper.classList.add("is-active");
    }
    wrapper.dataset.key = handle.key;
    wrapper.style.left = `${handle.x * scale}px`;
    wrapper.style.top = `${handle.y * scale}px`;
    wrapper.style.width = `${handle.width * scale}px`;
    wrapper.style.height = `${handle.height * scale}px`;

    const label = document.createElement("div");
    label.className = "drag-label";
    label.textContent = handle.label;

    const box = document.createElement("div");
    box.className = "drag-box";

    const boxText = document.createElement("div");
    boxText.className = "drag-box-text";
    boxText.textContent = handle.textSpec?.text || "";
    boxText.style.fontSize = `${(handle.textSpec?.fontSize || 28) * scale}px`;

    box.appendChild(boxText);
    wrapper.append(label, box);
    previewOverlay.appendChild(wrapper);
  });
}

function renderAll() {
  if (!builtInTemplate) {
    previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    previewOverlay.replaceChildren();
    return;
  }

  drawPosterTo(ctx);
  drawPosterTo(previewCtx);
  updatePreviewHandles();
}

function downloadCanvas(filename) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function loadLayout() {
  try {
    const response = await fetch("/api/layout");
    if (!response.ok) {
      layout = structuredClone(defaultLayout);
      return;
    }
    const loaded = await response.json();
    layout = {
      dateStrip: { ...DEFAULT_LAYOUT.dateStrip, ...(loaded.dateStrip || {}) },
      slots: DEFAULT_LAYOUT.slots.map((slot) => {
        const found = findSlotByValueField(loaded.slots || [], slot.valueField);
        return { ...slot, ...(found || {}), valueField: slot.valueField };
      }),
    };
  } catch (_error) {
    layout = structuredClone(defaultLayout);
  }
}

async function loadDefaultLayout() {
  try {
    const response = await fetch("/api/default-layout");
    if (!response.ok) {
      defaultLayout = structuredClone(DEFAULT_LAYOUT);
      return;
    }
    const loaded = await response.json();
    defaultLayout = {
      dateStrip: { ...DEFAULT_LAYOUT.dateStrip, ...(loaded.dateStrip || {}) },
      slots: DEFAULT_LAYOUT.slots.map((slot) => {
        const found = findSlotByValueField(loaded.slots || [], slot.valueField);
        return { ...slot, ...(found || {}), valueField: slot.valueField };
      }),
    };
  } catch (_error) {
    defaultLayout = structuredClone(DEFAULT_LAYOUT);
  }
}

async function saveLayout() {
  try {
    const response = await fetch("/api/layout", {
      method: "POST",
      headers: getJsonHeadersWithOptionalWriteToken(),
      body: JSON.stringify(layout),
    });
    if (!response.ok) {
      throw new Error(response.status === 401 || response.status === 503 ? `auth error (${response.status})` : "save failed");
    }
    statusText.textContent = "ບັນທຶກ layout ແລ້ວ";
  } catch (error) {
    statusText.textContent = `ບັນທຶກ layout ບໍ່ສຳເລັດ: ${error.message}`;
  }
}

async function saveDefaultLayout() {
  try {
    const [defaultResponse, layoutResponse] = await Promise.all([
      fetch("/api/default-layout", {
        method: "POST",
        headers: getJsonHeadersWithOptionalWriteToken(),
        body: JSON.stringify(layout),
      }),
      fetch("/api/layout", {
        method: "POST",
        headers: getJsonHeadersWithOptionalWriteToken(),
        body: JSON.stringify(layout),
      }),
    ]);
    if (!defaultResponse.ok || !layoutResponse.ok) {
      throw new Error("save failed");
    }
    defaultLayout = structuredClone(layout);
    statusText.textContent = "ບັນທຶກຕຳແໜ່ງນີ້ເປັນ default ໃໝ່ແລ້ວ";
  } catch (error) {
    statusText.textContent = `ບັນທຶກ default ບໍ່ສຳເລັດ: ${error.message}`;
  }
}

function getLayoutTarget(key) {
  if (key === "date") {
    return layout.dateStrip;
  }
  const normalizedKey = normalizeValueFieldName(key);
  return layout.slots.find((slot) => normalizeValueFieldName(slot.valueField) === normalizedKey);
}

function getPreviewScale() {
  return previewCanvas.clientWidth / previewCanvas.width || 1;
}

function onDragMove(event) {
  if (!dragState) {
    return;
  }

  const scale = getPreviewScale();
  const rect = previewOverlay.getBoundingClientRect();
  const target = getLayoutTarget(dragState.key);
  if (!target) {
    return;
  }

  const currentX = (event.clientX - rect.left) / scale;
  const currentY = (event.clientY - rect.top) / scale;
  const dx = Math.round(currentX - dragState.startPointerX);
  const dy = Math.round(currentY - dragState.startPointerY);

  target.x = dragState.startX + dx;
  target.y = dragState.startY + dy;
  target.textX = dragState.startTextX + dx;
  target.textY = dragState.startTextY + dy;

  if (!dragRaf) {
    dragRaf = requestAnimationFrame(() => { dragRaf = null; renderAll(); });
  }
}

function onDragEnd() {
  if (!dragState) {
    return;
  }

  dragState = null;
  window.removeEventListener("pointermove", onDragMove);
  window.removeEventListener("pointerup", onDragEnd);
  renderAll();
}

function handleOverlayPointerDown(event) {
  const handle = event.target.closest(".drag-handle");
  if (!handle) {
    return;
  }

  const overlayRect = previewOverlay.getBoundingClientRect();
  const scale = getPreviewScale();
  const target = getLayoutTarget(handle.dataset.key);
  dragState = {
    key: handle.dataset.key,
    startPointerX: (event.clientX - overlayRect.left) / scale,
    startPointerY: (event.clientY - overlayRect.top) / scale,
    startX: target.x ?? 0,
    startY: target.y ?? 0,
    startTextX: target.textX ?? 0,
    startTextY: target.textY ?? 0,
  };
  renderAll();
  window.addEventListener("pointermove", onDragMove);
  window.addEventListener("pointerup", onDragEnd);
}

async function uploadTemplate(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });

  let response;
  try {
    response = await fetch("/api/template", {
      method: "POST",
      headers: getJsonHeadersWithOptionalWriteToken(),
      body: JSON.stringify({ filename: file.name, dataUrl }),
    });
  } catch (_error) {
    throw new Error("server_unreachable");
  }

  if (!response.ok) {
    throw new Error(`upload_http_${response.status}`);
  }

  await loadTemplate();
  statusText.textContent = `ອັບເດດ template ແລ້ວ: ${file.name}`;
}

async function publishToWordpress() {
  const payload = getPosterData();
  let response;
  try {
    response = await fetch("/api/publish-wordpress", {
      method: "POST",
      headers: getJsonHeadersWithOptionalWriteToken(),
      body: JSON.stringify(payload),
    });
  } catch (_error) {
    throw new Error("publish_server_unreachable");
  }

  let body = null;
  try {
    body = await response.json();
  } catch (_error) {
    body = null;
  }

  if (!response.ok) {
    const reason = body?.error ? `${response.status}:${body.error}` : String(response.status);
    throw new Error(`publish_http_${reason}`);
  }

  return body || { ok: true };
}

async function updatePublicDisplayData() {
  const payload = getPosterData();
  let response;
  try {
    response = await fetch("/api/display-data", {
      method: "POST",
      headers: getJsonHeadersWithOptionalWriteToken(),
      body: JSON.stringify(payload),
    });
  } catch (_error) {
    throw new Error("display_server_unreachable");
  }

  let body = null;
  try {
    body = await response.json();
  } catch (_error) {
    body = null;
  }

  if (!response.ok) {
    const reason = body?.error ? `${response.status}:${body.error}` : String(response.status);
    throw new Error(`display_http_${reason}`);
  }

  return body || { ok: true };
}

async function loadTemplate() {
  let response;
  try {
    response = await fetch(`/api/template?ts=${Date.now()}`, { cache: "no-store" });
  } catch (_error) {
    builtInTemplate = null;
    renderAll();
    throw new Error("server_unreachable");
  }

  if (response.status === 404) {
    builtInTemplate = null;
    renderAll();
    throw new Error("template_missing");
  }

  if (!response.ok) {
    builtInTemplate = null;
    renderAll();
    throw new Error(`template_http_${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        builtInTemplate = image;
        renderAll();
        resolve();
      };
      image.onerror = () => reject(new Error("template_decode_failed"));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getTemplateErrorMessage(error) {
  if (error?.message === "server_unreachable") {
    return "ເຊື່ອມຕໍ່ server ບໍ່ໄດ້";
  }
  if (error?.message === "template_missing") {
    return "ບໍ່ພົບ template ໃນໂຟນເດີ assets";
  }
  if (error?.message === "template_decode_failed") {
    return "ໄຟລ໌ template ເປີດບໍ່ໄດ້";
  }
  if (error?.message?.startsWith("template_http_")) {
    return `server ຕອບກັບຜິດພາດ (${error.message.replace("template_http_", "")})`;
  }
  if (error?.message?.startsWith("upload_http_")) {
    return `ອັບໂຫຼດ template ບໍ່ສຳເລັດ (${error.message.replace("upload_http_", "")})`;
  }
  if (error?.message === "publish_server_unreachable") {
    return "ສົ່ງໄປ WordPress ບໍ່ໄດ້ (server unreachable)";
  }
  if (error?.message?.startsWith("publish_http_")) {
    return `ສົ່ງໄປ WordPress ບໍ່ສຳເລັດ (${error.message.replace("publish_http_", "")})`;
  }
  if (error?.message === "display_server_unreachable") {
    return "ອັບເດດ Public Display ບໍ່ໄດ້ (server unreachable)";
  }
  if (error?.message?.startsWith("display_http_")) {
    return `ອັບເດດ Public Display ບໍ່ສຳເລັດ (${error.message.replace("display_http_", "")})`;
  }
  return error?.message || "ບໍ່ຮູ້ສາເຫດ";
}

async function bootstrap() {
  const publicConfig = await loadPublicConfig();
  const showLocalTokenInput = publicConfig?.showLocalTokenInput !== false;
  if (writeApiTokenField) {
    writeApiTokenField.style.display = showLocalTokenInput ? "" : "none";
  }

  const savedToken = localStorage.getItem(LOCAL_TOKEN_STORAGE_KEY);
  if (showLocalTokenInput && savedToken && writeApiTokenInput) {
    writeApiTokenInput.value = savedToken;
  }

  initializeDateTimeInputs();
  await ensureLaoFontsLoaded();
  await Promise.all([loadDefaultLayout(), loadLayout()]);
  try {
    await loadTemplate();
    statusText.textContent = "ໂຫຼດ template ແລ້ວ";
  } catch (error) {
    statusText.textContent = getTemplateErrorMessage(error);
  }
}

exportButton.addEventListener("click", () => {
  if (!builtInTemplate) {
    statusText.textContent = "ຍັງບໍ່ມີ template ສຳລັບ export";
    return;
  }

  renderAll();
  const safeDate = fields.date.value.trim().replace(/[^\d-]/g, "-") || "poster";
  downloadCanvas(`gold-price-final-${safeDate}.png`);
  statusText.textContent = `export ຮູບສຸດທ້າຍແລ້ວ: gold-price-final-${safeDate}.png`;
});

uploadTemplateButton.addEventListener("click", () => {
  templateFileInput.click();
});

saveLayoutButton.addEventListener("click", () => {
  saveLayout();
});

saveDefaultButton.addEventListener("click", async () => {
  const confirmed = window.confirm("ຕ້ອງການບັນທຶກຕຳແໜ່ງປັດຈຸບັນເປັນ default ໃໝ່ ແລະແທນຄ່າເກົ່າບໍ?");
  if (!confirmed) {
    return;
  }

  await saveDefaultLayout();
});

resetLayoutButton.addEventListener("click", async () => {
  const confirmed = window.confirm("ຕ້ອງການຣີເຊັດຕຳແໜ່ງຂໍ້ຄວາມກັບໄປຫາ default ແລະຂຽນທັບ layout ທີ່ບັນທຶກໄວ້ບໍ?");
  if (!confirmed) {
    return;
  }

  layout = structuredClone(defaultLayout);
  renderAll();
  await saveLayout();
  statusText.textContent = "ຣີເຊັດຕຳແໜ່ງກັບໄປຫາ default ແລ້ວ";
});

publishWordpressButton.addEventListener("click", async () => {
  try {
    publishWordpressButton.disabled = true;
    statusText.textContent = "ກຳລັງສົ່ງຂໍ້ມູນໄປ WordPress...";
    const result = await publishToWordpress();
    const responseStatus = result?.status ? ` (HTTP ${result.status})` : "";
    statusText.textContent = `ສົ່ງຂໍ້ມູນໄປ WordPress ສຳເລັດ${responseStatus}`;
  } catch (error) {
    statusText.textContent = getTemplateErrorMessage(error);
  } finally {
    publishWordpressButton.disabled = false;
  }
});

openDisplayButton.addEventListener("click", () => {
  const displayUrl = `${window.location.origin}/display`;
  window.open(displayUrl, "_blank", "noopener,noreferrer");
});

updateDisplayButton.addEventListener("click", async () => {
  try {
    updateDisplayButton.disabled = true;
    statusText.textContent = "ກຳລັງອັບເດດ Public Display...";
    await updatePublicDisplayData();
    const displayUrl = `${window.location.origin}/display`;
    statusText.textContent = `ອັບເດດ Public Display ສຳເລັດ: ${displayUrl}`;
  } catch (error) {
    statusText.textContent = getTemplateErrorMessage(error);
  } finally {
    updateDisplayButton.disabled = false;
  }
});

templateFileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    await uploadTemplate(file);
  } catch (error) {
    statusText.textContent = getTemplateErrorMessage(error);
  }

  templateFileInput.value = "";
});

Object.values(fields).forEach((input) => {
  input.addEventListener("input", () => {
    if (input.dataset.format === "number") {
      input.value = formatNumberInput(input.value);
    }
    renderAll();
  });
});

if (writeApiTokenInput) {
  writeApiTokenInput.addEventListener("input", () => {
    const token = getWriteApiToken();
    if (token) {
      localStorage.setItem(LOCAL_TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(LOCAL_TOKEN_STORAGE_KEY);
    }
  });
}

previewOverlay.addEventListener("pointerdown", handleOverlayPointerDown);
window.addEventListener("resize", () => {
  if (resizeRaf) cancelAnimationFrame(resizeRaf);
  resizeRaf = requestAnimationFrame(() => { resizeRaf = null; renderAll(); });
});

bootstrap();
