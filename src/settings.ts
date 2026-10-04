const STORAGE_KEY = 'inmb:settings';

/** 設定パネル「音のバランス」の値。キーは入力欄の id（m-<キー>）に対応する */
export interface Settings {
  master: number;
  bgm: number;
  crowd: number;
  sfx: number;
  /** 注文の間隔（分） */
  interval: number;
  duck: boolean;
}

const DEFAULTS: Settings = { master: 80, bgm: 60, crowd: 40, sfx: 70, interval: 5, duck: true };

export function loadSettings(): Settings {
  const settings = { ...DEFAULTS };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof saved === 'object' && saved !== null) {
      // 型が合う値だけを取り込む
      for (const key of Object.keys(DEFAULTS) as Array<keyof Settings>) {
        const value = (saved as Record<string, unknown>)[key];
        if (typeof value === typeof DEFAULTS[key]) (settings as Record<string, unknown>)[key] = value;
      }
    }
  } catch {
    // 読めない保存データは無視して、初期値を使う
  }
  return settings;
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存できない環境でも、その場では動かす
  }
}
