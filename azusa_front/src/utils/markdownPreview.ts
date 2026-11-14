import { renderMarkdownDocument } from './markdownDocument';

export interface MarkdownPreviewResult {
  html: string;
  mermaidTexts: string[];
}

/**
 * Markdown 解析器预览：直接复用文章正文的完整文档渲染管线。
 * 公式需先经 normalizeFormulaDelimiters 统一为 $...$ / $$...$$。
 */
export function renderMarkdownPreview(markdown: string): Promise<MarkdownPreviewResult> {
  if (!markdown.trim()) return Promise.resolve({ html: '', mermaidTexts: [] });
  return renderMarkdownDocument(markdown);
}
