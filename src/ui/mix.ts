import { $ } from '../dom';
import type { MusicPlayer } from '../music/player';
import { loadSettings, saveSettings, type Settings } from '../settings';

type RangeKey = { [K in keyof Settings]: Settings[K] extends number ? K : never }[keyof Settings];

const RANGE_KEYS: RangeKey[] = ['master', 'bgm', 'crowd', 'sfx', 'interval'];
const FORMAT: Partial<Record<RangeKey, (value: number) => string>> = {
  interval: v => `約 ${v} 分おき`,
};

// ざわめき・作業音・注文の間隔・ダッキングは、段階5で音に反映する。ここでは値の保存まで
export function initMix(player: MusicPlayer): void {
  const settings = loadSettings();
  const vol = $<HTMLInputElement>('#vol');

  const apply = () => {
    // プレイヤーの音量と、設定パネルの「全体」は同じ値
    vol.value = String(settings.master);
    player.setVolume((settings.master / 100) * (settings.bgm / 100));
    saveSettings(settings);
  };

  const ranges = RANGE_KEYS.map(key => {
    const range = $<HTMLInputElement>(`#m-${key}`);
    const output = $(`output[data-for="m-${key}"]`);
    const show = () => {
      range.value = String(settings[key]);
      output.textContent = FORMAT[key]?.(settings[key]) ?? String(settings[key]);
    };
    range.addEventListener('input', () => {
      settings[key] = Number(range.value);
      show();
      apply();
    });
    show();
    return { key, show };
  });

  vol.addEventListener('input', () => {
    settings.master = Number(vol.value);
    ranges.find(r => r.key === 'master')?.show();
    apply();
  });

  const duck = $<HTMLInputElement>('#m-duck');
  duck.checked = settings.duck;
  duck.addEventListener('change', () => {
    settings.duck = duck.checked;
    apply();
  });

  apply();
}
