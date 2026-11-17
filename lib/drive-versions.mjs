/** Direct child videos in upload order. File ID breaks timestamp ties consistently. */
export function orderFolderVideos(files) {
  const unique = new Map();
  for (const file of files) {
    if (file?.id && file.mimeType?.startsWith('video/')) unique.set(file.id, file);
  }
  const timestamp = file => {
    const value = Date.parse(file.createdTime || '');
    return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
  };
  return [...unique.values()].sort((a, b) => timestamp(a) - timestamp(b) || a.id.localeCompare(b.id));
}
