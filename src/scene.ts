import { $ } from './dom';

export interface Scene {
  id: string;
  title: string;
  accent: string;
  accentDeep: string;
  accentHover: string;
  base: string;
}

// 段階2でシーン JSON の読み込みに置き換える
export const CAFE_WINDOW: Scene = {
  id: 'cafe-window',
  title: '窓際の席',
  accent: '#D6AA3F',
  accentDeep: '#A8812A',
  accentHover: '#E0B651',
  base: 'scenes/cafe-window/base.webp',
};

export function showScene(scene: Scene): void {
  const root = document.documentElement.style;
  root.setProperty('--accent', scene.accent);
  root.setProperty('--accent-deep', scene.accentDeep);
  root.setProperty('--accent-hover', scene.accentHover);

  const img = $<HTMLImageElement>('#scene');
  img.src = import.meta.env.BASE_URL + scene.base;
  img.alt = `${scene.title}のイラスト`;
}
