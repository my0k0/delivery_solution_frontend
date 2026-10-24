/**
 * Turn whatever the phone's camera produced into one predictable JPEG.
 *
 * Re-encoding is the point, not just the size cut: a canvas draw applies the
 * EXIF orientation (so the photo is not sideways) and drops every metadata
 * block (so GPS coordinates of the customer's door never leave the device).
 * HEIC from iOS is normalised to JPEG on the way through, which is also what
 * makes the byte-sniffing check on the API answer `image/jpeg`.
 */

/** Long edge of the stored photo. Enough to identify a package at a doorway. */
const DEFAULT_MAX_EDGE = 1600;

/** Visually indistinguishable from the original at 1600px. */
const DEFAULT_QUALITY = 0.8;

const UNREADABLE =
  'This photo could not be read. Take the photo again with the camera.';

interface DecodedImage {
  image: CanvasImageSource;
  width: number;
  height: number;
  /** Free the bitmap or revoke the object URL backing `image`. */
  release: () => void;
}

/**
 * `createImageBitmap` first because it decodes off the main thread and honours
 * EXIF orientation. It refuses some files older mobile engines hand it happily,
 * so an `<img>` decode is the fallback rather than the primary path.
 */
async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return {
        image: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> decoder.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return {
      image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => URL.revokeObjectURL(objectUrl),
    };
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error(UNREADABLE);
  }
}

export async function downscaleImageForUpload(
  file: File,
  maxEdge = DEFAULT_MAX_EDGE,
  quality = DEFAULT_QUALITY,
): Promise<File> {
  const decoded = await decodeImage(file);
  try {
    // Never upscale: a small photo stays the size it was taken.
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error(UNREADABLE);
    context.drawImage(decoded.image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    if (!blob) throw new Error(UNREADABLE);

    return new File([blob], 'delivery-proof.jpg', {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    decoded.release();
  }
}
