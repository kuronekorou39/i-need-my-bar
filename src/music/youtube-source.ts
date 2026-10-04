import { SourceError, type MusicSource, type PlaylistItem, type SourceCallbacks } from './types';

const API_URL = 'https://www.youtube.com/iframe_api';
/** API の読み込みと、プレイヤーの準備を待つ上限 */
const READY_TIMEOUT_MS = 10_000;
/** 読み込みを始めてから再生が始まるまでの上限。超えたら接続できないとみなす */
const START_TIMEOUT_MS = 20_000;
/** プレイリストの中で、この数だけ続けて再生できなければ、その項目をあきらめる */
const LIST_ERROR_LIMIT = 3;

// YT.PlayerState
const STATE_ENDED = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;

// IFrame Player API のうち、使うものだけ
interface YTPlayer {
  loadVideoById(videoId: string): void;
  loadPlaylist(options: { list: string; listType: 'playlist'; index?: number }): void;
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  nextVideo(): void;
  setVolume(volume: number): void;
  getVideoData(): { title?: string } | undefined;
  getPlaylist(): string[] | null;
  getPlaylistIndex(): number;
}
interface YTPlayerOptions {
  width: string;
  height: string;
  playerVars: Record<string, number>;
  events: {
    onReady(): void;
    onStateChange(event: { data: number }): void;
    onError(event: { data: number }): void;
  };
}
declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer };
    onYouTubeIframeAPIReady?: () => void;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

let apiPromise: Promise<void> | null = null;

function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;

  const script = document.createElement('script');
  script.src = API_URL;
  const loading = new Promise<void>((resolve, reject) => {
    window.onYouTubeIframeAPIReady = resolve;
    script.onerror = () => reject(new Error('load'));
  });
  document.head.append(script);

  apiPromise = withTimeout(loading, READY_TIMEOUT_MS).catch(error => {
    // 次に YouTube の曲を流すとき、もう一度読み込みを試す
    script.remove();
    apiPromise = null;
    throw error;
  });
  return apiPromise;
}

/** 動画かプレイリストの URL から ID を取り出す。YouTube の URL でなければ null */
export function parseYouTubeUrl(input: string): { videoId?: string; listId?: string } | null {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  const isId = (id: string | null | undefined): id is string => !!id && /^[\w-]+$/.test(id);

  let videoId: string | null | undefined;
  if (host === 'youtu.be') {
    videoId = url.pathname.split('/')[1];
  } else if (host === 'youtube.com') {
    const [, kind, id] = url.pathname.split('/');
    videoId = ['shorts', 'embed', 'live'].includes(kind) ? id : url.searchParams.get('v');
  } else {
    return null;
  }

  const list = url.searchParams.get('list');
  // 「ミックス」（RD で始まる自動生成のリスト）は埋め込みで読み込めないので、動画として扱う
  const listId = isId(list) && !list.startsWith('RD') ? list : undefined;
  if (listId) return { listId };
  return isId(videoId) ? { videoId } : null;
}

/**
 * YouTube の埋め込みプレイヤー。
 * 規約により、プレイヤーは隠さずに 200×200 以上で表示する。音量以外の音の加工はできない。
 */
export class YouTubeSource implements MusicSource {
  private playerPromise: Promise<YTPlayer> | null = null;
  private player: YTPlayer | null = null;
  private active = false;
  private isList = false;
  private volume = 1;
  private watchdog = 0;
  private listErrors = 0;

  constructor(
    private readonly dock: HTMLElement,
    private readonly mount: HTMLElement,
    private readonly callbacks: SourceCallbacks,
  ) {}

  async start(item: PlaylistItem): Promise<void> {
    this.active = true;
    this.isList = !!item.listId;
    this.listErrors = 0;
    if (!navigator.onLine) throw new SourceError('unavailable');

    this.dock.hidden = false;
    let player: YTPlayer;
    try {
      await loadApi();
      player = await this.ensurePlayer();
    } catch {
      throw new SourceError('unavailable');
    }
    // 準備を待つ間に、別の音源へ切り替えられた
    if (!this.active) return;

    player.setVolume(this.volume * 100);
    if (item.listId) player.loadPlaylist({ list: item.listId, listType: 'playlist', index: 0 });
    else if (item.videoId) player.loadVideoById(item.videoId);
    else throw new SourceError('track');
    this.armWatchdog();
  }

  resume(): void {
    this.player?.playVideo();
    this.armWatchdog();
  }

  pause(): void {
    this.clearWatchdog();
    this.player?.pauseVideo();
  }

  stop(): void {
    this.active = false;
    this.clearWatchdog();
    this.player?.stopVideo();
    this.dock.hidden = true;
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.player?.setVolume(volume * 100);
  }

  nextInItem(): boolean {
    if (!this.player || !this.hasNextInList()) return false;
    this.player.nextVideo();
    this.armWatchdog();
    return true;
  }

  private hasNextInList(): boolean {
    const list = this.isList ? this.player?.getPlaylist() : null;
    return !!list && this.player!.getPlaylistIndex() < list.length - 1;
  }

  private ensurePlayer(): Promise<YTPlayer> {
    this.playerPromise ??= withTimeout(
      new Promise<YTPlayer>(resolve => {
        const player = new window.YT!.Player(this.mount, {
          width: '100%',
          height: '100%',
          playerVars: { playsinline: 1 },
          events: {
            onReady: () => {
              this.player = player;
              resolve(player);
            },
            onStateChange: event => this.handleState(event.data),
            onError: event => this.handleError(event.data),
          },
        });
      }),
      READY_TIMEOUT_MS,
    ).catch(error => {
      this.playerPromise = null;
      throw error;
    });
    return this.playerPromise;
  }

  private handleState(state: number): void {
    if (!this.active) return;
    if (state === STATE_PLAYING) {
      this.clearWatchdog();
      this.listErrors = 0;
      const title = this.player?.getVideoData()?.title;
      if (title) this.callbacks.onTitle(title);
      this.callbacks.onPlaying(true);
    } else if (state === STATE_PAUSED) {
      this.callbacks.onPlaying(false);
    } else if (state === STATE_ENDED && !this.hasNextInList()) {
      // プレイリストの途中なら、プレイヤーが自分で次の動画へ進む
      this.callbacks.onEnded();
    }
  }

  // 埋め込み禁止・削除済みなど、その動画が再生できない
  private handleError(code: number): void {
    if (!this.active) return;
    console.warn(`YouTube の動画を再生できません（エラー ${code}）`);
    this.clearWatchdog();
    this.listErrors++;
    if (this.listErrors < LIST_ERROR_LIMIT && this.nextInItem()) return;
    this.callbacks.onError('track');
  }

  private armWatchdog(): void {
    this.clearWatchdog();
    this.watchdog = window.setTimeout(() => {
      if (this.active) this.callbacks.onError('unavailable');
    }, START_TIMEOUT_MS);
  }

  private clearWatchdog(): void {
    clearTimeout(this.watchdog);
  }
}
