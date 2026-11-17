export type FolderMediaFile = { id: string; mimeType: string; createdTime?: string };
export function orderFolderVideos<T extends FolderMediaFile>(files: T[]): T[];
