// 路径输入的本地缓存：记住上一次用过的路径，下次打开工具页自动填充。
// 存储不可用（隐私模式、禁用存储等）时静默降级为无缓存。
const PREFIX = 'tool-path:';

export function loadPath(key: string): string {
  try {
    return localStorage.getItem(PREFIX + key) ?? '';
  } catch {
    return '';
  }
}

export function savePath(key: string, value: string): void {
  try {
    const v = value.trim();
    if (v) localStorage.setItem(PREFIX + key, v);
    else localStorage.removeItem(PREFIX + key); // 清空输入即视为不再使用该路径
  } catch {
    // 静默降级
  }
}
