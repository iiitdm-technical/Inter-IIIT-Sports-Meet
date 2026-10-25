/**
 * Payment proof file types, shared by the upload form and the upload API.
 *
 * Browsers do not report file types reliably: Windows can send an empty type
 * for a PDF, and some phones send "image/jpg". The server therefore decides
 * the type from the file's own bytes, and the form only pre-checks it.
 */
export const PROOF_EXTENSIONS = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

const NAME_TYPES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

/** Type implied by a file name's extension, or null. */
export function proofTypeFromName(name = "") {
  const extension = name.split(".").pop()?.toLowerCase();
  return NAME_TYPES[extension] || null;
}

/** Best guess at an accepted type from what the browser reports. */
export function guessProofType(file) {
  const reported = (file?.type || "").toLowerCase();
  if (reported === "image/jpg" || reported === "image/pjpeg") return "image/jpeg";
  if (reported === "application/x-pdf") return "application/pdf";
  return PROOF_EXTENSIONS[reported] ? reported : proofTypeFromName(file?.name);
}

/**
 * Type from the file's leading bytes, or null when it is not a PDF, JPEG or
 * PNG. PDF readers accept a header anywhere in the first 1 KB, so do we.
 */
export function detectProofType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((part, index) => bytes[index] === part)) return "image/png";
  const head = String.fromCharCode(...bytes.slice(0, 1024));
  return head.includes("%PDF-") ? "application/pdf" : null;
}
