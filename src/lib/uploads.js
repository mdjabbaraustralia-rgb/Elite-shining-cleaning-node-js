const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
// Allow uploaded images to live outside the deployed code directory (e.g. a
// persistent volume on the host), so a redeploy that replaces the app's code
// never wipes real uploaded gallery/service/logo images. Falls back to the
// in-repo public/storage path for local development. If STORAGE_DIR is moved
// to an external volume, copy the existing public/storage/ contents there
// once so already-uploaded images keep working.
const STORAGE_DIR = process.env.STORAGE_DIR || path.join(PUBLIC_DIR, 'storage');
fs.mkdirSync(STORAGE_DIR, { recursive: true });

// Resize (down only) and compress an uploaded image, then store it under
// public/storage/<directory>/. Mirrors the Laravel ManagesUploadedFiles trait.
async function storeOptimizedImage(fileBuffer, directory, { maxWidth = 1600, quality = 80, preserveTransparency = false } = {}) {
  const dir = path.join(STORAGE_DIR, directory);
  fs.mkdirSync(dir, { recursive: true });

  let image = sharp(fileBuffer).rotate(); // rotate() auto-orients based on EXIF
  const meta = await image.metadata();

  if (meta.width && meta.width > maxWidth) {
    image = image.resize({ width: maxWidth });
  }

  const filename = crypto.randomBytes(20).toString('hex');
  let ext, buffer;
  if (preserveTransparency) {
    ext = 'png';
    buffer = await image.png().toBuffer();
  } else {
    ext = 'jpg';
    buffer = await image.jpeg({ quality }).toBuffer();
  }

  const relPath = `${directory}/${filename}.${ext}`;
  fs.writeFileSync(path.join(STORAGE_DIR, relPath), buffer);

  return `/storage/${relPath}`;
}

function deleteOldUpload(publicPath) {
  if (!publicPath) return;
  if (!publicPath.startsWith('/storage/')) return; // never touch bundled /images/ assets
  const rel = publicPath.replace(/^\/storage\//, '');
  const full = path.join(STORAGE_DIR, rel);
  fs.unlink(full, () => {}); // best-effort, ignore errors
}

module.exports = { storeOptimizedImage, deleteOldUpload, STORAGE_DIR };
