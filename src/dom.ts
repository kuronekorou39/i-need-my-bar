export function $<T extends Element = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`要素が見つかりません: ${selector}`);
  return el;
}
