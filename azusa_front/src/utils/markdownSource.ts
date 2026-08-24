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
