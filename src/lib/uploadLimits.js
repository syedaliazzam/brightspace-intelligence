export const STORAGE_SAFE_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

export function formatUploadLimit(maxBytes = STORAGE_SAFE_UPLOAD_MAX_BYTES) {
  const sizeInMb = maxBytes / (1024 * 1024);
  return `${sizeInMb % 1 === 0 ? sizeInMb : sizeInMb.toFixed(1)} MB`;
}
