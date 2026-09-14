import type { ResumePhotoCrop } from '@nexus/shared';

const PHOTO_SIZE = 384;
const SOURCE_MAX_EDGE = 1200;

export async function prepareProfilePhoto(file: File): Promise<string> {
  const source = await prepareProfilePhotoSource(file);
  return cropProfilePhoto(source, { x: 0, y: 0, zoom: 1 });
}

export async function prepareProfilePhotoSource(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadProfileImage(objectUrl);
    const scale = Math.min(1, SOURCE_MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.78);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function cropProfilePhoto(
  sourceDataUrl: string,
  crop: ResumePhotoCrop,
): Promise<string> {
  const image = await loadProfileImage(sourceDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is unavailable.');
  drawProfilePhotoCrop(context, image, crop, PHOTO_SIZE);
  return canvas.toDataURL('image/jpeg', 0.84);
}

export function drawProfilePhotoCrop(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  crop: ResumePhotoCrop,
  size: number,
) {
  const scale =
    Math.max(size / image.naturalWidth, size / image.naturalHeight) * clamp(crop.zoom, 1, 3);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const horizontalTravel = Math.max(0, (width - size) / 2);
  const verticalTravel = Math.max(0, (height - size) / 2);
  const x = (size - width) / 2 + clamp(crop.x, -1, 1) * horizontalTravel;
  const y = (size - height) / 2 + clamp(crop.y, -1, 1) * verticalTravel;

  context.clearRect(0, 0, size, size);
  context.drawImage(image, x, y, width, height);
}

export function photoCropTravel(image: HTMLImageElement, size: number, zoom: number) {
  const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight) * clamp(zoom, 1, 3);
  return {
    x: Math.max(0, (image.naturalWidth * scale - size) / 2),
    y: Math.max(0, (image.naturalHeight * scale - size) / 2),
  };
}

export function loadProfileImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be decoded.'));
    image.src = src;
  });
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
