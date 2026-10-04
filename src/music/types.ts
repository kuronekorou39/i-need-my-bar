export type TrackSource = 'yt' | 'bundle' | 'local';

export interface PlaylistItem {
  id: string;
  type: TrackSource;
  name: string;
  on: boolean;
  /** yt：動画の ID */
  videoId?: string;
  /** yt：プレイリストの ID */
  listId?: string;
  /** bundle：サイト内のパス。local のファイル本体は IndexedDB に id で保存する */
  src?: string;
}

/** unavailable：その音源そのものが使えない（オフラインなど）／ track：その曲だけが流せない */
export type SourceErrorKind = 'unavailable' | 'track';

export class SourceError extends Error {
  constructor(readonly kind: SourceErrorKind) {
    super(kind);
  }
}

export interface SourceCallbacks {
  onEnded(): void;
  onError(kind: SourceErrorKind): void;
  onTitle(title: string): void;
  /** 音源側の操作（YouTube のプレイヤーを直接押すなど）で再生状態が変わった */
  onPlaying(playing: boolean): void;
}

export interface MusicSource {
  /** 曲を読み込んで再生を始める。失敗したら SourceError を投げる */
  start(item: PlaylistItem): Promise<void>;
  resume(): void;
  pause(): void;
  stop(): void;
  /** 0〜1 */
  setVolume(volume: number): void;
  /** 同じ項目の中（プレイリスト）に次の曲があれば、進めて true を返す */
  nextInItem(): boolean;
}
