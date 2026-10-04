import type { LoadedScene, SceneDef } from './types';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function isSceneDef(value: unknown): value is SceneDef {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.accent === 'string' && HEX_COLOR.test(v.accent) &&
    typeof v.paper === 'string' && HEX_COLOR.test(v.paper) &&
    Array.isArray(v.size) && v.size.length === 2 && v.size.every(n => typeof n === 'number' && n > 0) &&
    typeof v.base === 'string' &&
    (v.edgeFade === undefined || typeof v.edgeFade === 'number') &&
    Array.isArray(v.layers)
  );
}

export async function loadScene(id: string): Promise<LoadedScene> {
  const base = import.meta.env.BASE_URL;
  const res = await fetch(`${base}scenes/${id}/scene.json`);
  if (!res.ok) throw new Error(`シーンを読み込めません: ${id}（${res.status}）`);
  const def: unknown = await res.json();
  if (!isSceneDef(def)) throw new Error(`シーンの定義が正しくありません: ${id}`);

  const image = new Image();
  image.src = base + def.base;
  await image.decode();
  return { def, base: image };
}

/** UI の色をシーンに合わせる */
export function applySceneColors(def: SceneDef): void {
  const style = document.documentElement.style;
  style.setProperty('--paper', def.paper);
  style.setProperty('--accent', def.accent);
}
