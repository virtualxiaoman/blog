/**
 * 将 public/ 下的 Markdown 相对路径转换为可请求地址。
 * 统一处理 Vite 在 GitHub Pages 子路径（/blog/）部署时的 BASE_URL 前缀。
 */
export function resolveMarkdownSource(source: string): string {
  if (/^(https?:)?\/\//.test(source) || source.startsWith('data:')) {
    return source;
  }

  return `${import.meta.env.BASE_URL}${source.replace(/^\/+/, '')}`;
}

// 同一篇文章的正文渲染、复制全文、字数统计共用一份文本，避免重复请求。
// 缓存的是 Promise：并发调用共享同一次请求；失败后移除缓存，下次调用可重试。
const markdownCache = new Map<string, Promise<string>>();

export function fetchMarkdown(source: string): Promise<string> {
  const url = resolveMarkdownSource(source);
  const cached = markdownCache.get(url);
  if (cached) return cached;

  const request = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Markdown 加载失败: ${r.status}`);
    return r.text();
  });
  request.catch(() => markdownCache.delete(url));
  markdownCache.set(url, request);
  return request;
}
