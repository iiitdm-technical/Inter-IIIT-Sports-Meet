import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const TEMPLATE_PATH = path.join(process.cwd(), "public", "assets", "id_card_design.pdf");
const FONT_PATH = path.join(process.cwd(), "public", "assets", "fonts", "NotoSerif-Regular.ttf");

// Exact coordinates measured from public/assets/id_card_design.pdf (page 1: 446.88 x 675.75 pts).
// The two black horizontal fill lines are drawn as rects:
//   NAME line: x = 138.24, y = 195.024, width = 260.64, height = 1.296
//   IIIT line: x = 138.24, y = 143.184, width = 260.64, height = 1.296
export const ID_CARD_FIELDS = {
  lineXStart: 138.24,
  lineWidth: 260.64,
  horizontalPadding: 8,
  nameLineY: 195.024,
  instituteLineY: 143.184,
  baselineOffset: 6.5,
  maxFontSize: 17,
  minFontSize: 10,
};

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

function drawCenteredField(page, font, text, lineY) {
  const clean = sanitizeCardText(text);
  if (!clean) return;

  const { lineXStart, lineWidth, horizontalPadding, baselineOffset, maxFontSize, minFontSize } = ID_CARD_FIELDS;
  const maxTextWidth = lineWidth - horizontalPadding * 2;
  const fontSize = fitFontSize(font, clean, maxTextWidth, maxFontSize, minFontSize);
  const textWidth = font.widthOfTextAtSize(clean, fontSize);

  const x = lineXStart + (lineWidth - textWidth) / 2;
  const y = lineY + baselineOffset;

  page.drawText(clean, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(0.08, 0.08, 0.08),
  });
}

/**
 * Generates a filled copy of the ID card PDF with the student's name and
 * institute centered on the NAME and IIIT blank fields. Photo space is left empty.
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
