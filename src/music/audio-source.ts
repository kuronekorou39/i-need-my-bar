import { getFile } from './files';
import { SourceError, type MusicSource, type PlaylistItem, type SourceCallbacks } from './types';

/** 同梱曲と手元の曲。Web Audio を通すので、あとから音質の加工を足せる */
export class AudioSource implements MusicSource {
  private readonly audio = new Audio();
  private context: AudioContext | null = null;
  private gain: GainNode | null = null;
  private objectUrl: string | null = null;
  private volume = 1;
  /** start のたびに進める。待っている間に別の曲へ切り替わったら、古いほうは何もしない */
  private generation = 0;
  private active = false;
  /** start の中の失敗は例外で伝えるので、その間は error イベントを二重に伝えない */
  private starting = false;

  constructor(callbacks: SourceCallbacks) {
    this.audio.preload = 'auto';
    this.audio.addEventListener('ended', () => {
      if (this.active) callbacks.onEnded();
    });
    this.audio.addEventListener('error', () => {
      if (this.active && !this.starting) callbacks.onError('track');
    });
  }

  async start(item: PlaylistItem): Promise<void> {
    const generation = ++this.generation;
    this.release();
    this.ensureGraph();

    let url: string;
    if (item.type === 'local') {
      const file = await getFile(item.id).catch(() => undefined);
      if (generation !== this.generation) return;
      if (!file) throw new SourceError('track');
      url = this.objectUrl = URL.createObjectURL(file);
    } else if (item.src) {
      url = import.meta.env.BASE_URL + item.src;
    } else {
      throw new SourceError('track');
    }

    this.active = true;
    this.starting = true;
    this.audio.src = url;
    try {
      // ユーザーの操作なしでは resume が終わらないことがあるので、待たない
      void this.context?.resume();
      await this.audio.play();
    } catch {
      // 待っている間に止められた・切り替えられた場合は、失敗として扱わない
      if (generation === this.generation && this.active) {
        this.release();
        throw new SourceError('track');
      }
    } finally {
      if (generation === this.generation) this.starting = false;
    }
  }

  resume(): void {
    void this.context?.resume();
    void this.audio.play().catch(() => {});
  }

  pause(): void {
    this.audio.pause();
  }

  stop(): void {
    this.generation++;
    this.release();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.gain) this.gain.gain.value = volume;
  }

  nextInItem(): boolean {
    return false;
  }

  // AudioContext はユーザーの操作のあとでないと作れないので、最初の再生で用意する
  private ensureGraph(): void {
    if (this.context) return;
    this.context = new AudioContext();
    this.gain = this.context.createGain();
    this.gain.gain.value = this.volume;
    this.context.createMediaElementSource(this.audio).connect(this.gain).connect(this.context.destination);
  }

  private release(): void {
    this.active = false;
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
