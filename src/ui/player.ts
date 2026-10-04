import { $ } from '../dom';
import type { Playlist, TrackSource } from './playlist';

const SOURCE_LABEL: Record<TrackSource, string> = { yt: 'YouTube から', bundle: '同梱曲', local: '手元の曲' };

const ICON_PLAY = '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>';
const ICON_PAUSE =
  '<rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/>' +
  '<rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/>';

// 段階1では音を鳴らさない。表示の切り替えだけを行う
export function initPlayer(playlist: Playlist): void {
  const playBtn = $('#playBtn');
  const playIcon = $<SVGElement>('#playIcon');
  const title = $('#trackTitle');
  const source = $('#trackSrc');
  const status = $('#status');

  let itemIndex = 0;
  let trackIndex = 0;
  let playing = false;

  const enabled = () => playlist.items().filter(item => item.on);

  function showTrack() {
    const items = enabled();
    if (!items.length) {
      title.textContent = '曲がありません';
      source.textContent = '設定から曲を追加してください';
      return;
    }
    const item = items[itemIndex % items.length];
    const tracks = item.tracks ?? [item.name];
    title.textContent = tracks[trackIndex % tracks.length];
    source.textContent = tracks.length > 1 ? `${SOURCE_LABEL[item.type]}・${item.name}` : SOURCE_LABEL[item.type];
  }

  function nextTrack() {
    const items = enabled();
    if (items.length) {
      const item = items[itemIndex % items.length];
      if (item.tracks && trackIndex < item.tracks.length - 1) {
        trackIndex++;
      } else {
        trackIndex = 0;
        itemIndex = (itemIndex + 1) % items.length;
      }
    }
    showTrack();
  }

  function setPlaying(next: boolean) {
    playing = next;
    playIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute('aria-label', playing ? '一時停止' : '開店する（再生）');
    status.textContent = playing ? '開店しました（音はまだ準備中です）' : '一時停止しています';
  }

  playBtn.addEventListener('click', () => setPlaying(!playing));
  $('#nextBtn').addEventListener('click', nextTrack);
  playlist.onChange(showTrack);

  playIcon.innerHTML = ICON_PLAY;
  status.textContent = '再生すると、店が開きます';
  showTrack();
}
