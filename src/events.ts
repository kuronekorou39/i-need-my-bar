import type { PlaylistItem } from './music/types';

// 音・絵・表示をつなぐイベントバス（docs/plan.md の「全体像」）
export interface BusEvents {
  'playlist:change': undefined;
  /** 表示する曲が変わった。item が null なら流せる曲がない */
  'music:track': { item: PlaylistItem | null; title: string };
  'music:state': { playing: boolean };
  /** プレイヤーからのお知らせ（フォールバックなど）。空文字で消す */
  'music:notice': { text: string };
}

type Listener<K extends keyof BusEvents> = (payload: BusEvents[K]) => void;

class EventBus {
  private listeners: { [K in keyof BusEvents]?: Array<Listener<K>> } = {};

  on<K extends keyof BusEvents>(type: K, listener: Listener<K>): void {
    const list: Array<Listener<K>> = (this.listeners[type] ??= []);
    list.push(listener);
  }

  emit<K extends keyof BusEvents>(type: K, ...payload: BusEvents[K] extends undefined ? [] : [BusEvents[K]]): void {
    this.listeners[type]?.forEach(listener => listener(payload[0] as BusEvents[K]));
  }
}

export const bus = new EventBus();
