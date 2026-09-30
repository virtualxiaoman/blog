/**
 * 滚动到目标元素，并在随后一段时间内持续校正位置。
 *
 * 文章图片启用了懒加载（loading="lazy"）：跳转目标较远时，滚动路径上的图片
 * 尚未加载，smooth 滚动经过时它们陆续加载并撑高文档，把目标向下推，
 * 导致滚动结束时停在目标上方。mermaid 图表的异步渲染也有同样的高度抖动。
 *
 * 校正策略：初始滚动后，用 ResizeObserver 监听目标所在内容容器的高度变化，
 * 每次变化就瞬时（auto）重新对齐目标；用户主动滚动（wheel/touchmove）或
 * 超过 maxDuration 后停止校正。
 *
 * 返回停止函数，调用方可提前取消（如组件卸载）。
 */
export function scrollToElementStable(
  target: Element,
  options: { behavior?: ScrollBehavior; block?: ScrollLogicalPosition; maxDuration?: number } = {},
): () => void {
  const { behavior = 'smooth', block = 'start', maxDuration = 4000 } = options;
  const root = target.closest('.markdown-body') ?? document.body;

  target.scrollIntoView({ behavior, block });

  // ResizeObserver 启动时会立即回调一次当前尺寸，跳过以免打断初始的平滑滚动
  let first = true;
  const observer = new ResizeObserver(() => {
    if (first) {
      first = false;
      return;
    }
    target.scrollIntoView({ behavior: 'auto', block });
  });

  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
    window.removeEventListener('wheel', stop);
    window.removeEventListener('touchmove', stop);
  };
  const timer = window.setTimeout(stop, maxDuration);
  observer.observe(root);
  // 用户接管滚动后立即停止校正，避免把用户拽回目标
  window.addEventListener('wheel', stop, { passive: true });
  window.addEventListener('touchmove', stop, { passive: true });

  return stop;
}
