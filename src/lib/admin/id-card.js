import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const TEMPLATE_PATH = path.join(process.cwd(), "public", "assets", "id_card_design.pdf");
const FONT_PATH = path.join(process.cwd(), "public", "assets", "fonts", "NotoSerif-Regular.ttf");

const MM_TO_PT = 72 / 25.4;

// Exact coordinates measured from public/assets/id_card_design.pdf (page 1: 446.88 x 675.75 pts).
// The two black horizontal fill lines are drawn as rects:
//   NAME line: x = 138.24, y = 195.024, width = 260.64, height = 1.296
//   IIIT line: x = 138.24, y = 143.184, width = 260.64, height = 1.296
export const ID_CARD_FIELDS = {
  templateWidth: 446.88,
  templateHeight: 675.75,
  lineXStart: 138.24,
  lineWidth: 260.64,
  horizontalPadding: 8,
  nameLineY: 195.024,
  instituteLineY: 143.184,
  baselineOffset: 6.5,
  maxFontSize: 17,
  minFontSize: 10,
};

// Portrait A4 3-up double-sided foldable sheet layout:
// - A4 portrait: 210 mm x 297 mm
// - 3 columns side by side: 6 mm outer margins, 3 mm gaps -> 64 mm card width
// - Preserving template aspect ratio (446.88 / 675.75): 96.78 mm artwork height
// - 12 mm white top padding above Front and below rotated Back (for lanyard hole)
// - Page 1 (Front) upright on top half; Page 2 (Back) rotated 180 deg on bottom half
//   so folding along the center horizontal seam aligns both 12 mm punch areas at the top.
export const A4_SHEET_LAYOUT = {
  pageWidthPt: 210 * MM_TO_PT,
  pageHeightPt: 297 * MM_TO_PT,
  columns: 3,
  marginXPt: 6 * MM_TO_PT,
  gapXPt: 3 * MM_TO_PT,
  cardWidthPt: 64 * MM_TO_PT,
  holePadPt: 12 * MM_TO_PT,
  cropMarkLenPt: 4 * MM_TO_PT,
  cropMarkOffsetPt: 1.5 * MM_TO_PT,
};

const SHEET_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const SHEET_CACHE_MAX_ENTRIES = 30;
const sheetCacheSymbol = Symbol.for("inter-iiit-sports-meet.id-sheet-cache");

function getSheetCache() {
  if (!globalThis[sheetCacheSymbol]) {
    globalThis[sheetCacheSymbol] = new Map();
  }
  return globalThis[sheetCacheSymbol];
}

function pruneSheetCache(cache) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) cache.delete(key);
  }
  while (cache.size > SHEET_CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

export function cacheGeneratedSheet({ pdfBytes, filename, studentIds }) {
  const cache = getSheetCache();
  pruneSheetCache(cache);
  const key = randomUUID();
  const expiresAt = Date.now() + SHEET_CACHE_TTL_MS;
  cache.set(key, { pdfBytes, filename, studentIds, expiresAt });
  return { key, expiresAt };
}

export function getCachedSheet(key) {
  const cache = getSheetCache();
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry;
}

let cachedAssetsPromise = null;

function loadAssets() {
  if (!cachedAssetsPromise) {
    cachedAssetsPromise = Promise.all([
      readFile(TEMPLATE_PATH),
      readFile(FONT_PATH),
    ]).catch((error) => {
      cachedAssetsPromise = null;
      throw error;
    });
  }
  return cachedAssetsPromise;
}

export function sanitizeCardText(value) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\x20-\x7E\u00A0-\u024F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function fitFontSize(font, text, maxWidth, maxSize, minSize) {
  let size = maxSize;
  while (size > minSize && font.widthOfTextAtSize(text, size) > maxWidth) {
    size = Number((size - 0.5).toFixed(1));
  }
  return size;
}

function drawCenteredField(page, font, text, lineY, { originX = 0, originY = 0, scale = 1 } = {}) {
  const clean = sanitizeCardText(text);
  if (!clean) return;

  const { lineXStart, lineWidth, horizontalPadding, baselineOffset, maxFontSize, minFontSize } = ID_CARD_FIELDS;
  const maxTextWidth = lineWidth - horizontalPadding * 2;
  const unscaledSize = fitFontSize(font, clean, maxTextWidth, maxFontSize, minFontSize);
  const unscaledTextWidth = font.widthOfTextAtSize(clean, unscaledSize);

  const unscaledX = lineXStart + (lineWidth - unscaledTextWidth) / 2;
  const unscaledY = lineY + baselineOffset;

  page.drawText(clean, {
    x: originX + unscaledX * scale,
    y: originY + unscaledY * scale,
    size: unscaledSize * scale,
    font,
    color: rgb(0.08, 0.08, 0.08),
  });
}

function drawCropMark(page, x1, y1, x2, y2, color) {
  page.drawLine({
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    thickness: 0.5,
    color,
  });
}

/**
 * Generates a single filled copy of the 2-page ID card template PDF.
 */
export async function generateStudentIdCardPdf({ name, institute }) {
  const [templateBytes, fontBytes] = await loadAssets();

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const serifFont = await pdfDoc.embedFont(fontBytes, { subset: true });
  const pages = pdfDoc.getPages();
  const frontPage = pages[0];
  if (!frontPage) {
    throw new Error("ID card template PDF has no pages");
  }

  drawCenteredField(frontPage, serifFont, name, ID_CARD_FIELDS.nameLineY);
  drawCenteredField(frontPage, serifFont, institute, ID_CARD_FIELDS.instituteLineY);

  return pdfDoc.save();
}

/**
 * Generates a single Portrait A4 print sheet holding 1 to 3 student ID cards
 * side by side. Each card column contains:
 *   - 12 mm white hole-punch padding at top
 *   - Page 1 (Front) upright with centered Name & Institute
 *   - Horizontal center fold line
 *   - Page 2 (Back) rotated 180° (so folding aligns both 12 mm punch areas at top)
 *   - 12 mm white hole-punch padding at bottom
 * Plus hairline crop/cut marks around each card strip.
 */
export async function generateIdCardSheetPdf(entries) {
  if (!Array.isArray(entries) || entries.length === 0 || entries.length > A4_SHEET_LAYOUT.columns) {
    throw new Error("A sheet must contain between 1 and 3 students");
  }

  const [templateBytes, fontBytes] = await loadAssets();
  const templateDoc = await PDFDocument.load(templateBytes);
  const templatePages = templateDoc.getPages();
  if (templatePages.length < 2) {
    throw new Error("ID card template PDF must have 2 pages (front and back)");
  }

  const outDoc = await PDFDocument.create();
  outDoc.registerFontkit(fontkit);
  const serifFont = await outDoc.embedFont(fontBytes, { subset: true });

  // Embed template pages once so all 3 cards share the same PDF XObject streams.
  const [embeddedFront, embeddedBack] = await outDoc.embedPages([templatePages[0], templatePages[1]]);

  const {
    pageWidthPt,
    pageHeightPt,
    marginXPt,
    gapXPt,
    cardWidthPt,
    holePadPt,
    cropMarkLenPt,
    cropMarkOffsetPt,
  } = A4_SHEET_LAYOUT;

  const scale = cardWidthPt / ID_CARD_FIELDS.templateWidth;
  const artHeightPt = ID_CARD_FIELDS.templateHeight * scale;
  const faceHeightPt = artHeightPt + holePadPt;
  const stripHeightPt = faceHeightPt * 2;
  const stripBottomY = (pageHeightPt - stripHeightPt) / 2;
  const foldY = stripBottomY + faceHeightPt;
  const stripTopY = stripBottomY + stripHeightPt;

  const page = outDoc.addPage([pageWidthPt, pageHeightPt]);
  const cutColor = rgb(0.42, 0.42, 0.42);
  const borderColor = rgb(0.75, 0.75, 0.75);

  entries.forEach((student, index) => {
    const colX = marginXPt + index * (cardWidthPt + gapXPt);
    const colRightX = colX + cardWidthPt;

    // Top half: Front (Page 1, upright). Artwork sits directly above foldY;
    // 12 mm white space sits between (foldY + artHeightPt) and stripTopY.
    page.drawPage(embeddedFront, {
      x: colX,
      y: foldY,
      xScale: scale,
      yScale: scale,
    });

    // Draw student Name and Institute centered over Front's blank lines.
    drawCenteredField(page, serifFont, student.name, ID_CARD_FIELDS.nameLineY, {
      originX: colX,
      originY: foldY,
      scale,
    });
    drawCenteredField(page, serifFont, student.institute, ID_CARD_FIELDS.instituteLineY, {
      originX: colX,
      originY: foldY,
      scale,
    });

    // Bottom half: Back (Page 2, rotated 180°).
    // With 180° rotation in pdf-lib, (x, y) is the top-right corner of the drawn box.
    // Artwork occupies y in [stripBottomY + holePadPt, foldY], leaving 12 mm white space at bottom.
    page.drawPage(embeddedBack, {
      x: colRightX,
      y: foldY,
      xScale: scale,
      yScale: scale,
      rotate: degrees(180),
    });

    // Faint outer cut guide around the full foldable strip (including 12 mm top & bottom pads)
    page.drawRectangle({
      x: colX,
      y: stripBottomY,
      width: cardWidthPt,
      height: stripHeightPt,
      borderColor,
      borderWidth: 0.4,
    });

    // Dashed horizontal fold line at center seam
    page.drawLine({
      start: { x: colX, y: foldY },
      end: { x: colRightX, y: foldY },
      thickness: 0.5,
      color: cutColor,
      dashArray: [3, 3],
    });

    // External corner crop marks (top-left, top-right, bottom-left, bottom-right)
    // Vertical ticks above top edge and below bottom edge
    drawCropMark(page, colX, stripTopY + cropMarkOffsetPt, colX, stripTopY + cropMarkOffsetPt + cropMarkLenPt, cutColor);
    drawCropMark(page, colRightX, stripTopY + cropMarkOffsetPt, colRightX, stripTopY + cropMarkOffsetPt + cropMarkLenPt, cutColor);
    drawCropMark(page, colX, stripBottomY - cropMarkOffsetPt, colX, stripBottomY - cropMarkOffsetPt - cropMarkLenPt, cutColor);
    drawCropMark(page, colRightX, stripBottomY - cropMarkOffsetPt, colRightX, stripBottomY - cropMarkOffsetPt - cropMarkLenPt, cutColor);

    // Horizontal ticks on outer left (first card) and outer right (last card)
    if (index === 0) {
      drawCropMark(page, colX - cropMarkOffsetPt, stripTopY, colX - cropMarkOffsetPt - cropMarkLenPt, stripTopY, cutColor);
      drawCropMark(page, colX - cropMarkOffsetPt, foldY, colX - cropMarkOffsetPt - cropMarkLenPt, foldY, cutColor);
      drawCropMark(page, colX - cropMarkOffsetPt, stripBottomY, colX - cropMarkOffsetPt - cropMarkLenPt, stripBottomY, cutColor);
    }
    if (index === entries.length - 1) {
      drawCropMark(page, colRightX + cropMarkOffsetPt, stripTopY, colRightX + cropMarkOffsetPt + cropMarkLenPt, stripTopY, cutColor);
      drawCropMark(page, colRightX + cropMarkOffsetPt, foldY, colRightX + cropMarkOffsetPt + cropMarkLenPt, foldY, cutColor);
      drawCropMark(page, colRightX + cropMarkOffsetPt, stripBottomY, colRightX + cropMarkOffsetPt + cropMarkLenPt, stripBottomY, cutColor);
    }
  });

  return outDoc.save();
}
