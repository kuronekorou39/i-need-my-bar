import { bus } from '../events';
import { AudioSource } from './audio-source';
import type { PlaylistStore } from './store';
import { SourceError, type MusicSource, type PlaylistItem, type SourceCallbacks, type SourceErrorKind } from './types';
import { YouTubeSource } from './youtube-source';

/** YouTube の曲がこの数だけ続けて流せなければ、YouTube 以外の曲に切り替える */
const YT_ERROR_LIMIT = 2;

const NOTICE_FALLBACK = 'YouTube を再生できないため、ほかの曲を流しています';
const NOTICE_NOTHING_PLAYABLE = '流せる曲がありません。設定で曲のリストを確認してください';

/** 曲のリストを上から順に流す。YouTube が使えないときは、ほかの曲に切り替える */
export class MusicPlayer {
  private readonly audio: MusicSource;
  private readonly youtube: MusicSource;
  private activeSource: MusicSource | null = null;

  private current: PlaylistItem | null = null;
  /** 音源から届いた曲名（YouTube）。なければ項目の名前を使う */
  private title: string | null = null;
  /** current が音源に読み込み済みか */
  private loaded = false;
  private playing = false;
  private volume = 1;
  /** start のたびに進める。待っている間に別の曲へ切り替わったら、古い結果は捨てる */
  private token = 0;

  /** 続けて失敗した数。一巡しても流せなければ止める */
  private failures = 0;
  private ytErrors = 0;
  /** YouTube を飛ばして流している */
  private fallback = false;

  constructor(
    private readonly store: PlaylistStore,
    youtubeDock: HTMLElement,
    youtubeMount: HTMLElement,
  ) {
    const callbacks: SourceCallbacks = {
      onEnded: () => this.handleEnded(),
      onError: kind => this.handleError(kind),
      onTitle: title => this.handleTitle(title),
      onPlaying: playing => this.handlePlaying(playing),
    };
    this.audio = new AudioSource(callbacks);
    this.youtube = new YouTubeSource(youtubeDock, youtubeMount, callbacks);
    bus.on('playlist:change', () => this.syncWithList());
    this.syncWithList();
  }

  /** 今の状態をイベントで流し直す（UI の初期表示用） */
  refresh(): void {
    this.emitTrack();
    bus.emit('music:state', { playing: this.playing });
  }

  toggle(): void {
    if (this.playing) {
      this.setPlaying(false);
      this.activeSource?.pause();
    } else if (this.loaded) {
      this.setPlaying(true);
      this.activeSource?.resume();
    } else {
      const item = this.current ?? this.pick(null);
      if (item) void this.start(item);
    }
  }

  next(): void {
    if (this.loaded && this.playing && this.activeSource?.nextInItem()) return;
    const item = this.pick(this.current);
    if (!item) return;
    if (this.playing) {
      void this.start(item);
    } else {
      // 止まっている間は、表示する曲だけを進める
      this.unload();
      this.current = item;
      this.emitTrack();
    }
  }

  setVolume(volume: number): void {
    this.volume = volume;
    this.activeSource?.setVolume(volume);
  }

  private isPlayable(item: PlaylistItem): boolean {
    return item.on && !(this.fallback && item.type === 'yt');
  }

  /** after の次に流す項目。末尾まで行ったら先頭に戻る */
  private pick(after: PlaylistItem | null): PlaylistItem | null {
    const list = this.store.items();
    const from = after ? list.findIndex(item => item.id === after.id) : -1;
    for (let n = 1; n <= list.length; n++) {
      const item = list[(from + n) % list.length];
      if (this.isPlayable(item)) return item;
    }
    return null;
  }

  private async start(item: PlaylistItem): Promise<void> {
    const token = ++this.token;
    this.unload();
    this.current = item;
    this.setPlaying(true);
    this.emitTrack();

    const source = item.type === 'yt' ? this.youtube : this.audio;
    this.activeSource = source;
    source.setVolume(this.volume);
    try {
      await source.start(item);
    } catch (error) {
      if (token === this.token) this.handleError(error instanceof SourceError ? error.kind : 'track');
      return;
    }
    if (token !== this.token) return;

    this.loaded = true;
    // 読み込みを待つ間に一時停止された
    if (!this.playing) source.pause();
    // YouTube は、実際に再生が始まった時点（handlePlaying）で成功とみなす
    if (item.type !== 'yt') this.markSuccess();
  }

  private unload(): void {
    this.activeSource?.stop();
    this.activeSource = null;
    this.loaded = false;
    this.title = null;
  }

  private markSuccess(): void {
    this.failures = 0;
    if (this.current?.type === 'yt') this.ytErrors = 0;
    if (!this.fallback) bus.emit('music:notice', { text: '' });
  }

  private handlePlaying(playing: boolean): void {
    if (playing) this.markSuccess();
    this.setPlaying(playing);
  }

  private handleTitle(title: string): void {
    const item = this.current;
    if (!item) return;
    this.title = title;
    // 動画ひとつの項目は、リストの名前も実際の題名に直す
    if (item.type === 'yt' && !item.listId && item.name !== title) this.store.rename(item.id, title);
    else this.emitTrack();
  }

  private handleEnded(): void {
    // 次の曲から YouTube に戻れるか試す。だめなら、また切り替わる
    if (this.fallback && navigator.onLine) {
      this.fallback = false;
      this.ytErrors = 0;
    }
    const item = this.pick(this.current);
    if (item) void this.start(item);
    else this.halt(NOTICE_NOTHING_PLAYABLE);
  }

  private handleError(kind: SourceErrorKind): void {
    const enabled = this.store.items().filter(item => item.on);
    this.failures++;

    if (this.current?.type === 'yt') {
      this.ytErrors++;
      const hasOther = enabled.some(item => item.type !== 'yt');
      if (hasOther && !this.fallback && (kind === 'unavailable' || this.ytErrors >= YT_ERROR_LIMIT)) {
        this.fallback = true;
        bus.emit('music:notice', { text: NOTICE_FALLBACK });
      }
    }

    const item = this.failures < enabled.length ? this.pick(this.current) : null;
    if (item) void this.start(item);
    else this.halt(NOTICE_NOTHING_PLAYABLE);
  }

  private halt(notice: string): void {
    this.token++;
    this.unload();
    this.failures = 0;
    this.setPlaying(false);
    bus.emit('music:notice', { text: notice });
  }

  /** リストが編集された。流している曲が消えた・オフになったら、次へ進む */
  private syncWithList(): void {
    const current = this.current && this.store.items().find(item => item.id === this.current!.id);
    if (current?.on) {
      this.current = current;
    } else if (this.current && this.playing) {
      const item = this.pick(this.current);
      if (item) {
        void this.start(item);
        return;
      }
      this.halt('');
      this.current = null;
    } else {
      this.token++;
      this.unload();
      this.current = this.pick(null);
    }
    this.emitTrack();
  }

  private setPlaying(playing: boolean): void {
    if (this.playing === playing) return;
    this.playing = playing;
    bus.emit('music:state', { playing });
  }

  private emitTrack(): void {
    const item = this.current;
    bus.emit('music:track', { item, title: this.title ?? item?.name ?? '' });
  }
}
