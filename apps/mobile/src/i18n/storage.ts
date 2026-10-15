/**
 * Web（含 react-native-web）语言偏好持久化。
 *
 * 优先使用浏览器 localStorage；当运行环境没有 localStorage（例如 SSR、
 * 隐私模式被禁用）时退回进程内 Map，保证接口行为一致、永不抛错。
 */

const memory = new Map<string, string>();

function localStorageOrNull(): Storage | null {
  try {
    const candidate = (globalThis as { localStorage?: Storage }).localStorage;
    return candidate ?? null;
  } catch {
    return null;
  }
}

/** 读取本地存储中的值，不存在或读取失败时返回 null。 */
export function readStorage(key: string): string | null {
  const storage = localStorageOrNull();
  if (storage) {
    try {
      const value = storage.getItem(key);
      if (value !== null) return value;
    } catch {
      // 忽略并退回内存态。
    }
  }
  return memory.get(key) ?? null;
}

/** 写入本地存储，失败时只更新内存，不抛出异常。 */
export function writeStorage(key: string, value: string): void {
  memory.set(key, value);
  const storage = localStorageOrNull();
  if (!storage) return;
  try {
    storage.setItem(key, value);
  } catch {
    // 忽略写入失败。
  }
}

/** 清空本地存储（仅用于测试）。 */
export function clearStorage(key: string): void {
  memory.delete(key);
  const storage = localStorageOrNull();
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // 忽略删除失败。
  }
}
