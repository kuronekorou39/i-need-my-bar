import { $ } from '../dom';
import { bus } from '../events';
import { listFileIds, pruneFiles, putFile } from '../music/files';
import { parsePlaylist, type PlaylistStore } from '../music/store';
import type { PlaylistItem, TrackSource } from '../music/types';
import { parseYouTubeUrl } from '../music/youtube-source';

const TYPE_LABEL: Record<TrackSource, string> = { yt: 'YouTube', bundle: '同梱', local: '手元' };

const SVG_ATTRS = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
const ICON_UP = `<svg ${SVG_ATTRS} stroke-width="2.6"><path d="M6 15l6-6 6 6"/></svg>`;
const ICON_DOWN = `<svg ${SVG_ATTRS} stroke-width="2.6"><path d="M6 9l6 6 6-6"/></svg>`;
const ICON_DELETE = `<svg ${SVG_ATTRS} stroke-width="2.4"><path d="M7 7l10 10M17 7L7 17"/></svg>`;

export function initPlaylist(store: PlaylistStore): void {
  const listEl = $('#list');
  const urlInput = $<HTMLInputElement>('#urlInput');
  const fileInput = $<HTMLInputElement>('#fileInput');
  const importInput = $<HTMLInputElement>('#importInput');
  const message = $('#addMsg');

  const localIds = () => store.items().filter(item => item.type === 'local').map(item => item.id);
  // 消した曲のファイル本体を IndexedDB からも消す
  const prune = () => void pruneFiles(localIds()).catch(() => {});

  function render() {
    // 描き直すと押したボタンが消えるので、同じ曲の同じ操作にフォーカスを戻す
    const focused = document.activeElement instanceof HTMLElement && listEl.contains(document.activeElement)
      ? { id: document.activeElement.closest('li')?.dataset.id, op: document.activeElement.dataset.op }
      : null;

    listEl.textContent = '';
    const items = store.items();
    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = item.on ? 'item' : 'item off';
      li.dataset.id = item.id;

      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = item.on;
      check.dataset.op = 'on';
      check.setAttribute('aria-label', `${item.name} を流す`);
      check.addEventListener('change', () => store.setOn(item.id, check.checked));

      const badge = document.createElement('span');
      badge.className = `badge ${item.type}`;
      badge.textContent = TYPE_LABEL[item.type];

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = item.name;
      name.title = item.name;

      const ops = document.createElement('span');
      ops.className = 'ops';
      const addOp = (op: string, icon: string, label: string, run: () => void, disabled = false) => {
        const btn = document.createElement('button');
        btn.className = 'mini';
        btn.innerHTML = icon;
        btn.dataset.op = op;
        btn.setAttribute('aria-label', label);
        btn.disabled = disabled;
        btn.addEventListener('click', run);
        ops.append(btn);
      };
      addOp('up', ICON_UP, `${item.name} を上へ`, () => store.move(item.id, -1), i === 0);
      addOp('down', ICON_DOWN, `${item.name} を下へ`, () => store.move(item.id, 1), i === items.length - 1);
      addOp('delete', ICON_DELETE, `${item.name} を削除`, () => {
        store.remove(item.id);
        prune();
      });

      li.append(check, badge, name, ops);
      listEl.append(li);
    });

    if (focused) {
      const row = Array.from(listEl.children).find(li => (li as HTMLElement).dataset.id === focused.id);
      const target = row?.querySelector<HTMLElement>(`[data-op="${focused.op}"]:not(:disabled)`)
        ?? (row ?? listEl).querySelector<HTMLElement>('[data-op="on"]')
        ?? urlInput;
      target.focus();
    }
  }

  function addUrl() {
    const ids = parseYouTubeUrl(urlInput.value.trim());
    if (!ids) {
      message.textContent = 'YouTube の動画かプレイリストの URL を貼ってください';
      return;
    }
    // 動画の題名は、最初に再生したときに取得して置き換える
    const name = ids.listId ? 'YouTube のプレイリスト' : 'YouTube の動画';
    store.add({ id: crypto.randomUUID(), type: 'yt', name, on: true, ...ids });
    urlInput.value = '';
    message.textContent = '';
  }
  $('#addUrl').addEventListener('click', addUrl);
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addUrl();
  });

  $('#addFile').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files ?? []);
    fileInput.value = '';
    try {
      const items: PlaylistItem[] = [];
      for (const file of files) {
        const id = crypto.randomUUID();
        await putFile(id, file);
        items.push({ id, type: 'local', name: file.name, on: true });
      }
      store.add(...items);
      message.textContent = '';
    } catch {
      message.textContent = 'このブラウザには曲を保存できませんでした';
    }
  });

  $('#exportBtn').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([store.serialize()], { type: 'application/json' }));
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
      const items = parsePlaylist(JSON.parse(await file.text()));
      if (!items) throw new Error('形式が違います');
      // 手元の曲はファイル本体がこのブラウザにあるものだけ残す（書き出した JSON に本体は入らない）
      const stored = new Set(await listFileIds().catch(() => []));
      const usable = items.filter(item => item.type !== 'local' || stored.has(item.id));
      store.replace(usable);
      prune();
      message.textContent = usable.length < items.length ? '手元の曲は、このブラウザに保存されているものだけ読み込みました' : '';
    } catch {
      message.textContent = 'このファイルは曲のリストとして読み込めませんでした';
    }
  });

  $('#resetBtn').addEventListener('click', () => {
    store.reset();
    prune();
    message.textContent = '';
  });

  bus.on('playlist:change', render);
  render();
  prune();
}
