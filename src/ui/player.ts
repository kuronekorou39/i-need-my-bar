import { $ } from '../dom';
import { bus } from '../events';
import type { MusicPlayer } from '../music/player';
import type { TrackSource } from '../music/types';

const SOURCE_LABEL: Record<TrackSource, string> = { yt: 'YouTube から', bundle: '同梱曲', local: '手元の曲' };

const ICON_PLAY = '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>';
const ICON_PAUSE =
  '<rect x="6.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/>' +
  '<rect x="13.5" y="5.5" width="4" height="13" rx="1" fill="currentColor"/>';

export function initPlayer(player: MusicPlayer): void {
  const playBtn = $('#playBtn');
  const playIcon = $<SVGElement>('#playIcon');
  const title = $('#trackTitle');
  const source = $('#trackSrc');
  const status = $('#status');

  let playing = false;
  let opened = false;
  let notice = '';

  // 店の状態（注文やシェイク）は段階5で出す。それまでは再生の状態とお知らせを出す
  const showStatus = () => {
    if (notice) status.textContent = notice;
    else if (playing) status.textContent = '音楽を流しています';
    else status.textContent = opened ? '一時停止しています' : '再生すると、店が開きます';
  };

  bus.on('music:track', track => {
    if (!track.item) {
      title.textContent = '曲がありません';
      source.textContent = '設定から曲を追加してください';
      return;
    }
    title.textContent = track.title;
    const label = SOURCE_LABEL[track.item.type];
    // プレイリストの中の曲は、どのリストから流しているかも添える
    source.textContent = track.title === track.item.name ? label : `${label}・${track.item.name}`;
  });

  bus.on('music:state', state => {
    playing = state.playing;
    opened ||= playing;
    playIcon.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
    playBtn.setAttribute('aria-label', playing ? '一時停止' : '開店する（再生）');
    showStatus();
  });

  bus.on('music:notice', event => {
    notice = event.text;
    showStatus();
  });

  playBtn.addEventListener('click', () => player.toggle());
  $('#nextBtn').addEventListener('click', () => player.next());
  player.refresh();
}
