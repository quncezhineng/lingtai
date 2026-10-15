/**
 * 原生端（iOS / Android）语言偏好持久化。
 *
 * 使用 expo-file-system 的新版同步 API，把语言偏好写入应用 Documents 目录下的
 * 一个纯文本文件，因此 App 重启后可以同步读取到上次的选择，不会出现语言闪回。
 * 任何读写异常都会被吞掉并退化为「内存态」，保证不会因为存储问题影响主流程。
 */
import { File, Paths } from "expo-file-system";

const FILE_NAME = "lingtai.preferences.locale";

const memory = new Map<string, string>();

function fileFor(key: string): File {
  return new File(Paths.document, `${FILE_NAME}.${key}`);
}

/** 读取本地存储中的值，不存在或读取失败时返回 null。 */
export function readStorage(key: string): string | null {
  try {
    const file = fileFor(key);
    if (!file.exists) return memory.get(key) ?? null;
    const value = file.textSync();
    return value.length ? value : null;
  } catch {
    return memory.get(key) ?? null;
  }
}

/** 写入本地存储，失败时只更新内存，不抛出异常。 */
export function writeStorage(key: string, value: string): void {
  memory.set(key, value);
  try {
    const file = fileFor(key);
    if (!file.exists) file.create({ intermediates: true, overwrite: true });
    file.write(value);
  } catch {
    // 存储不可用时静默降级为内存态。
  }
}

/** 清空本地存储（仅用于测试）。 */
export function clearStorage(key: string): void {
  memory.delete(key);
  try {
    const file = fileFor(key);
    if (file.exists) file.delete();
  } catch {
    // 忽略删除失败。
  }
}
