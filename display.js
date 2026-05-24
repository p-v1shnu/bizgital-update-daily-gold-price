const canvas = document.getElementById("displayCanvas");
const ctx = canvas.getContext("2d");
const statusText = document.getElementById("displayStatus");

const LAO_FONT_FAMILY = "'Noto Sans Lao Local', 'Noto Sans Lao', sans-serif";
const REFRESH_MS = 15000;
const TEMPLATE_REFRESH_MS = 60000;
const LAYOUT_REFRESH_MS = 5 * 60 * 1000;
const LEGACY_VALUE_FIELD_MAP = {
  printSellFiveTamlueng: "printSellFiveHoun",
  printBuyFiveTamlueng: "printBuyFiveHoun",
};

const DEFAULT_LAYOUT = {
  dateStrip: { x: 106, y: 252, width: 590, height: 72, textX: 400, textY: 310 },
  slots: [
    { x: 151, y: 529, width: 302, height: 66, textX: 302, textY: 580, valueField: "barSellOneBaht" },
    { x: 470, y: 529, width: 303, height: 66, textX: 622, textY: 580, valueField: "barBuyOneBaht" },
    { x: 151, y: 799, width: 302, height: 66, textX: 302, textY: 850, valueField: "printSellOneBaht" },
    { x: 470, y: 799, width: 303, height: 66, textX: 622, textY: 850, valueField: "printBuyOneBaht" },
    { x: 151, y: 918, width: 302, height: 66, textX: 302, textY: 948, valueField: "printSellOneSalueng" },
    { x: 470, y: 918, width: 303, height: 66, textX: 622, textY: 948, valueField: "printBuyOneSalueng" },
    { x: 151, y: 1039, width: 302, height: 66, textX: 302, textY: 1089, valueField: "printSellFiveHoun" },
    { x: 470, y: 1039, width: 303, height: 66, textX: 622, textY: 1089, valueField: "printBuyFiveHoun" },
  ],
};

let layout = structuredClone(DEFAULT_LAYOUT);
let latestData = null;
let templateImage = null;

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

function normalizeValueFieldName(valueField) {
  return LEGACY_VALUE_FIELD_MAP[valueField] || valueField;
}

function formatLak(value) {
  let number = value;
  if (typeof number === "string") {
    const digits = number.replace(/[^\d]/g, "");
    number = digits ? Number(digits) : NaN;
  }

  if (!Number.isFinite(number)) {
    return "";
  }
  return number.toLocaleString("en-US");
}

function getDisplayValue(data, key) {
  const legacyKey = key.replace("Houn", "Tamlueng");

  if (data?.values && typeof data.values === "object") {
    if (data.values[key] !== undefined) return data.values[key];
    if (data.values[legacyKey] !== undefined) return data.values[legacyKey];
  }

  return undefined;
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

function getDateDisplayText(data) {
  if (!data?.date && !data?.time) {
    return "";
  }
  return `ວັນທີ: ${data.date}  ເວລາ: ${data.time} ໂມງ`;
}

function getSlotDisplayText(slot, data) {
  const key = normalizeValueFieldName(slot.valueField);
  const raw = getDisplayValue(data, key);
  const value = formatLak(raw);
  return value ? `${value} ກີບ` : "";
}

function getAllTextSpecs(data) {
  const slotSpecs = layout.slots.map((slot) => {
    const text = getSlotDisplayText(slot, data);
    const fontSize = fitFontSize(ctx, text || " ", slot.width - 26, 31, LAO_FONT_FAMILY);
    return {
      text,
      x: slot.textX,
      y: slot.textY,
      font: `700 ${fontSize}px ${LAO_FONT_FAMILY}`,
      color: "#8d5811",
      shadow: false,
    };
  });

  return [
    {
      text: getDateDisplayText(data),
      x: layout.dateStrip.textX,
      y: layout.dateStrip.textY,
      font: `700 28px ${LAO_FONT_FAMILY}`,
      color: "#fff6e0",
      shadow: true,
    },
    ...slotSpecs,
  ];
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!templateImage) {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    statusText.textContent = "Template not found";
    return;
  }

  ctx.drawImage(templateImage, 0, 0, canvas.width, canvas.height);
  const specs = getAllTextSpecs(latestData);
  specs.forEach((spec) => {
    if (!spec.text) {
      return;
    }
    drawText(ctx, spec.text, spec.x, spec.y, {
      font: spec.font,
      color: spec.color,
      shadow: spec.shadow,
    });
  });

  if (!latestData) {
    statusText.textContent = "Waiting for first update...";
    return;
  }

  const updatedAtText = latestData.updatedAt
    ? new Date(latestData.updatedAt).toLocaleString()
    : "unknown";
  statusText.textContent = `Updated: ${updatedAtText}`;
}

async function fetchJsonNoStore(url) {
  const response = await fetch(`${url}?ts=${Date.now()}`, { cache: "no-store" });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`${url} http ${response.status}`);
  }
  return response.json();
}

function normalizeLayout(loaded) {
  if (!loaded || typeof loaded !== "object") {
    return structuredClone(DEFAULT_LAYOUT);
  }

  return {
    dateStrip: { ...DEFAULT_LAYOUT.dateStrip, ...(loaded.dateStrip || {}) },
    slots: DEFAULT_LAYOUT.slots.map((slot) => {
      const found = (loaded.slots || []).find(
        (item) => normalizeValueFieldName(item.valueField) === normalizeValueFieldName(slot.valueField),
      );
      return { ...slot, ...(found || {}), valueField: slot.valueField };
    }),
  };
}

async function refreshLayout() {
  const loadedLayout = await fetchJsonNoStore("/api/layout");
  if (loadedLayout) {
    layout = normalizeLayout(loadedLayout);
    return;
  }

  const loadedDefaultLayout = await fetchJsonNoStore("/api/default-layout");
  layout = normalizeLayout(loadedDefaultLayout);
}

async function refreshTemplate() {
  const response = await fetch(`/api/template?ts=${Date.now()}`, { cache: "no-store" });
  if (response.status === 404) {
    templateImage = null;
    return;
  }
  if (!response.ok) {
    throw new Error(`template http ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("template decode failed"));
      img.src = objectUrl;
    });
    templateImage = image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function refreshDisplayData() {
  const loaded = await fetchJsonNoStore("/api/display-data");
  latestData = loaded;
}

async function refreshAll() {
  try {
    await refreshDisplayData();
    render();
  } catch (error) {
    statusText.textContent = "Refresh failed. Retrying...";
    console.warn("Display refresh failed:", error.message);
  }
}

async function bootstrap() {
  try {
    await ensureLaoFontsLoaded();
  } catch (_error) {
    // Continue even if custom fonts fail to load; fallback fonts may still render text.
  }

  try {
    await refreshTemplate();
  } catch (error) {
    statusText.textContent = "Template load failed. Retrying...";
    console.warn("Template load failed:", error.message);
  }

  await refreshLayout().catch((error) => {
    console.warn("Layout load failed:", error.message);
  });
  await refreshAll();

  setInterval(async () => {
    try {
      await refreshTemplate();
      render();
    } catch (error) {
      statusText.textContent = "Template refresh failed. Retrying...";
      console.warn("Template refresh failed:", error.message);
    }
  }, TEMPLATE_REFRESH_MS);

  setInterval(async () => {
    try {
      await refreshLayout();
      render();
    } catch (error) {
      console.warn("Layout refresh failed:", error.message);
    }
  }, LAYOUT_REFRESH_MS);

  setInterval(refreshAll, REFRESH_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshAll();
    }
  });
}

bootstrap();
