import { $ } from '../dom';

// 段階1では表示だけ。音への反映は段階2以降
const FORMAT: Record<string, (value: string) => string> = {
  'm-interval': v => `約 ${v} 分おき`,
};

export function initMix(): void {
  document.querySelectorAll<HTMLInputElement>('.panel input[type=range]').forEach(range => {
    const output = $(`output[data-for="${range.id}"]`);
    const update = () => {
      output.textContent = FORMAT[range.id]?.(range.value) ?? range.value;
    };
    range.addEventListener('input', update);
    update();
  });

  // プレイヤーの音量と、設定パネルの「全体」は同じ値
  const vol = $<HTMLInputElement>('#vol');
  const master = $<HTMLInputElement>('#m-master');
  vol.addEventListener('input', () => {
    master.value = vol.value;
    master.dispatchEvent(new Event('input'));
  });
  master.addEventListener('input', () => {
    vol.value = master.value;
  });
}
