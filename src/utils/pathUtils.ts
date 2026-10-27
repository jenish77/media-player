/**
 * Safe utility to extract filename, extension, and virtual folder from any URI or path.
 */
export function extractFileName(uri: string): string {
  if (!uri) return 'Unknown Video';
  try {
    const decoded = decodeURIComponent(uri);
    const cleanPath = decoded.split('?')[0].split('#')[0];
    const parts = cleanPath.split(/[/\\]/);
    const lastPart = parts[parts.length - 1];
    return lastPart || 'Video File';
  } catch {
    return uri.split('/').pop() || 'Video File';
  }
}

export function extractFileExtension(fileNameOrUri: string): string {
  if (!fileNameOrUri) return '';
  const name = extractFileName(fileNameOrUri);
  const dotIndex = name.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return name.substring(dotIndex + 1).toLowerCase();
}

export function extractFolderName(uri: string): string {
  if (!uri) return 'Local Media';
  try {
    const decoded = decodeURIComponent(uri);
    const cleanPath = decoded.split('?')[0].split('#')[0];
    const parts = cleanPath.split(/[/\\]/).filter(Boolean);
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return 'Videos';
  } catch {
    return 'Videos';
  }
}

/**
 * Maps common file extensions to container names.
 */
export function getContainerFromExtension(ext: string): string {
  const map: Record<string, string> = {
    mp4: 'MP4',
    mkv: 'MKV',
    webm: 'WebM',
    avi: 'AVI',
    mov: 'MOV',
    ts: 'MPEG-TS',
    mts: 'MPEG-TS',
    '3gp': '3GP',
    flv: 'FLV',
    wmv: 'WMV',
  };
  return map[ext.toLowerCase()] || ext.toUpperCase() || 'Unknown';
}
