const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Detecta o resource_type do Cloudinary baseado no mimetype.
// 'image' para fotos, 'video' para vídeos, 'raw' para PDF e outros documentos.
function resourceTypeFromMime(mimetype) {
  if (!mimetype) return 'raw';
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('video/')) return 'video';
  return 'raw';
}

async function uploadFromBase64({ base64, mimetype, empresaSlug, tipo }) {
  const resource_type = resourceTypeFromMime(mimetype);
  const dataUri = `data:${mimetype};base64,${base64}`;
  const folder = `provas/${empresaSlug}/${tipo}`;
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type,
  });
  return {
    public_id:     result.public_id,
    url:           result.secure_url,
    resource_type: result.resource_type,
  };
}

async function destroy(publicId, resourceType) {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType || 'image' });
}

module.exports = { uploadFromBase64, destroy, resourceTypeFromMime };
