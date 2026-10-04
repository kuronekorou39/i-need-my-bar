import { bus } from '../events';
import type { PlaylistItem } from './types';

const STORAGE_KEY = 'inmb:playlist';
const FORMAT_VERSION = 1;
const DEFAULT_LIST_URL = 'music/playlist.json';

const YOUTUBE_ID = /^[\w-]+$/;
// 同梱曲はサイト内の music/ の下だけ。読み込んだ JSON から外部の URL を再生させない
const BUNDLE_SRC = /^music\/[\w.-]+$/;

function parseItem(value: unknown): PlaylistItem | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.name !== 'string' || typeof v.on !== 'boolean') return null;
  const common = { id: typeof v.id === 'string' && v.id ? v.id : crypto.randomUUID(), name: v.name, on: v.on };

  switch (v.type) {
    case 'yt': {
      const videoId = typeof v.videoId === 'string' && YOUTUBE_ID.test(v.videoId) ? v.videoId : undefined;
      const listId = typeof v.listId === 'string' && YOUTUBE_ID.test(v.listId) ? v.listId : undefined;
      return videoId || listId ? { ...common, type: 'yt', videoId, listId } : null;
    }
    case 'bundle':
      return typeof v.src === 'string' && BUNDLE_SRC.test(v.src) ? { ...common, type: 'bundle', src: v.src } : null;
    case 'local':
      return { ...common, type: 'local' };
    default:
      return null;
  }
}

/** 書き出した JSON（{ version, playlist }）を読む。形式が違えば null */
export function parsePlaylist(data: unknown): PlaylistItem[] | null {
  const playlist = (data as { playlist?: unknown } | null)?.playlist;
  if (!Array.isArray(playlist)) return null;
  const items = playlist.map(parseItem);
  return items.every(item => item !== null) ? items : null;
}

export class PlaylistStore {
  private constructor(
    private list: PlaylistItem[],
    private readonly defaults: PlaylistItem[],
  ) {}

  /** 保存済みのリストを読む。なければリポジトリ内の初期リストを使う */
  static async load(): Promise<PlaylistStore> {
    let defaults: PlaylistItem[] = [];
    try {
      const res = await fetch(import.meta.env.BASE_URL + DEFAULT_LIST_URL);
      defaults = parsePlaylist(await res.json()) ?? [];
    } catch {
      // 初期リストが読めなくても、保存済みのリストで動かす
    }

    let saved: PlaylistItem[] | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) saved = parsePlaylist(JSON.parse(raw));
    } catch {
      // 壊れた保存データは捨てて、初期リストに戻す
    }
    return new PlaylistStore(saved ?? structuredClone(defaults), defaults);
  }

  items(): readonly PlaylistItem[] {
    return this.list;
  }

  serialize(): string {
    return JSON.stringify({ version: FORMAT_VERSION, playlist: this.list }, null, 2);
  }

  add(...items: PlaylistItem[]): void {
    this.list.push(...items);
    this.commit();
  }

  setOn(id: string, on: boolean): void {
    this.patch(id, { on });
  }

  rename(id: string, name: string): void {
    this.patch(id, { name });
  }

  move(id: string, step: -1 | 1): void {
    const from = this.list.findIndex(item => item.id === id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= this.list.length) return;
    [this.list[from], this.list[to]] = [this.list[to], this.list[from]];
    this.commit();
  }

  remove(id: string): void {
    this.list = this.list.filter(item => item.id !== id);
    this.commit();
  }

  replace(items: PlaylistItem[]): void {
    this.list = items;
    this.commit();
  }

  reset(): void {
    this.replace(structuredClone(this.defaults));
  }

  private patch(id: string, change: Partial<PlaylistItem>): void {
    const item = this.list.find(it => it.id === id);
    if (!item) return;
    Object.assign(item, change);
    this.commit();
  }

  private commit(): void {
    try {
      localStorage.setItem(STORAGE_KEY, this.serialize());
    } catch {
      // 保存できない環境（プライベートブラウズなど）でも、その場では動かす
    }
    bus.emit('playlist:change');
  }
}
