import { $ } from '../dom';

export type TrackSource = 'yt' | 'bundle' | 'local';

export interface PlaylistItem {
  type: TrackSource;
  name: string;
  /** プレイリストの中の曲名 */
  tracks?: string[];
  on: boolean;
}

export interface Playlist {
  items(): readonly PlaylistItem[];
  onChange(listener: () => void): void;
}

// 段階1の仮データ。段階2でリポジトリ内の JSON に置き換える
const DEFAULT_LIST: PlaylistItem[] = [
  { type: 'yt', name: '（仮）YouTube のプレイリスト', tracks: ['（仮）1曲目', '（仮）2曲目', '（仮）3曲目'], on: true },
  { type: 'yt', name: '（仮）YouTube の動画', tracks: ['（仮）YouTube の動画'], on: true },
  { type: 'bundle', name: '（仮）同梱曲 01', on: true },
  { type: 'bundle', name: '（仮）同梱曲 02', on: true },
  { type: 'local', name: '（仮）手元の曲.mp3', on: false },
];

const TYPE_LABEL: Record<TrackSource, string> = { yt: 'YouTube', bundle: '同梱', local: '手元' };
const EXPORT_VERSION = 1;

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
const ICON_UP = `<svg ${SVG_ATTRS} stroke-width="2.6"><path d="M6 15l6-6 6 6"/></svg>`;
const ICON_DOWN = `<svg ${SVG_ATTRS} stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg>`;
const ICON_DELETE = `<svg ${SVG_ATTRS} stroke-width="2.4"><path d="M7 7l10 10M17 7L7 17"/></svg>`;

function isPlaylistItem(value: unknown): value is PlaylistItem {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === 'string' && v.type in TYPE_LABEL &&
    typeof v.name === 'string' &&
    typeof v.on === 'boolean' &&
    (v.tracks === undefined || (Array.isArray(v.tracks) && v.tracks.every(t => typeof t === 'string')))
  );
}

export function initPlaylist(): Playlist {
  let list = structuredClone(DEFAULT_LIST);
  const listeners: Array<() => void> = [];

  const listEl = $('#list');
  const urlInput = $<HTMLInputElement>('#urlInput');
  const fileInput = $<HTMLInputElement>('#fileInput');
  const importInput = $<HTMLInputElement>('#importInput');
  const message = $('#addMsg');

  const changed = () => {
    render();
    listeners.forEach(fn => fn());
  };

  function render() {
    listEl.textContent = '';
    list.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = item.on ? 'item' : 'item off';

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = item.on;
      check.setAttribute('aria-label', `${item.name} を流す`);
      check.addEventListener('change', () => {
        item.on = check.checked;
        changed();
      });

      const badge = document.createElement('span');
      badge.className = `badge ${item.type}`;
      badge.textContent = TYPE_LABEL[item.type];

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      name.title = item.name;

      const ops = document.createElement('span');
      ops.className = 'ops';
      const addOp = (icon: string, label: string, run: () => void, disabled = false) => {
        const btn = document.createElement('button');
        btn.className = 'mini';
        btn.innerHTML = icon;
        btn.setAttribute('aria-label', label);
        btn.disabled = disabled;
        btn.addEventListener('click', () => {
          run();
          changed();
        });
        ops.append(btn);
      };
      const swap = (a: number, b: number) => {
        [list[a], list[b]] = [list[b], list[a]];
      };
      addOp(ICON_UP, `${item.name} を上へ`, () => swap(i - 1, i), i === 0);
      addOp(ICON_DOWN, `${item.name} を下へ`, () => swap(i, i + 1), i === list.length - 1);
      addOp(ICON_DELETE, `${item.name} を削除`, () => list.splice(i, 1));

      li.append(check, badge, name, ops);
      listEl.append(li);
    });
  }

  $('#addUrl').addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!/youtu\.?be/.test(url)) {
      message.textContent = 'YouTube の動画かプレイリストの URL を貼ってください';
      return;
    }
    // 段階1では URL を解釈しない。題名の取得は段階2で行う
    const name = /[?&]list=/.test(url) ? '追加したプレイリスト' : '追加した動画';
    list.push({ type: 'yt', name, tracks: [name], on: true });
    urlInput.value = '';
    message.textContent = '';
    changed();
  });

  $('#addFile').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    for (const file of fileInput.files ?? []) list.push({ type: 'local', name: file.name, on: true });
    fileInput.value = '';
    changed();
  });

  $('#exportBtn').addEventListener('click', () => {
    const json = JSON.stringify({ version: EXPORT_VERSION, playlist: list }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'i-need-my-bar-playlist.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('#importBtn').addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file) return;
    try {
      const data: unknown = JSON.parse(await file.text());
      const playlist = (data as { playlist?: unknown } | null)?.playlist;
      if (!Array.isArray(playlist) || !playlist.every(isPlaylistItem)) throw new Error('形式が違います');
      list = playlist;
      message.textContent = '';
      changed();
    } catch {
      message.textContent = 'このファイルは曲のリストとして読み込めませんでした';
    }
  });

  $('#resetBtn').addEventListener('click', () => {
    list = structuredClone(DEFAULT_LIST);
    changed();
  });

  render();
  return {
    items: () => list,
    onChange: listener => listeners.push(listener),
  };
}
