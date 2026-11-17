export type Cache = {
  peek<T>(key: string): Promise<T> | undefined;
  load<T>(key: string, loader: () => PromiseLike<T> | T): Promise<T>;
  delete(key: string): boolean;
  clear(): void;
};
export function createCache(options?: { max?: number; ttl?: number; now?: () => number }): Cache;
export const presentationCache: Cache;
export const thumbnailCache: Cache;
export function clearClientCaches(): void;
