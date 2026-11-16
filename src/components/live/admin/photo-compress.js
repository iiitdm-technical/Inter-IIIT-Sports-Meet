/**
 * Shrinks a phone photo before upload: longest side 1600 px as a JPEG (about
 * 300–600 KB instead of 3–8 MB), plus a 360 px thumbnail. Re-encoding also
 * drops location data from the photo. Orientation from the camera is kept.
 */

const FULL_SIDE = 1600;
const THUMB_SIDE = 360;

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Fall back to <img>, which some browsers decode more formats with.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function encode(source, width, height, maxSide, quality) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#fff"; // PNGs with transparency become white, not black
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not prepare the photo"))), "image/jpeg", quality);
  });
}

/** Returns { photo: Blob, thumb: Blob | null }. Throws when the file is not a readable image. */
export async function preparePhoto(file) {
  let image;
  try {
    image = await decode(file);
  } catch {
    // Not decodable here (e.g. HEIC on some browsers): send it as-is if it is a JPEG/PNG.
    if (/^image\/(jpeg|png)$/.test(file.type)) return { photo: file, thumb: null };
    throw new Error("This photo format cannot be read here. Take the photo with the camera button instead.");
  }
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  try {
    const photo = await encode(image, width, height, FULL_SIDE, 0.82);
    const thumb = await encode(image, width, height, THUMB_SIDE, 0.7);
    return { photo, thumb };
  } finally {
    image.close?.();
  }
}
