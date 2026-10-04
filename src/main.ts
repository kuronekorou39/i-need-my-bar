import './style.css';
import { $ } from './dom';
import { MusicPlayer } from './music/player';
import { PlaylistStore } from './music/store';
import { applySceneColors, loadScene } from './scene/loader';
import { SceneRenderer } from './scene/renderer';
import { initDrawer } from './ui/drawer';
import { initMix } from './ui/mix';
import { initPlayer } from './ui/player';
import { initPlaylist } from './ui/playlist';

// 段階6でシーンの切り替えを入れるまでは、窓際のカフェ席だけ
const SCENE_ID = 'cafe-window';

initDrawer();

async function initScene(): Promise<void> {
  const scene = await loadScene(SCENE_ID);
  applySceneColors(scene.def);
  new SceneRenderer($<HTMLCanvasElement>('#scene'), scene);
}

async function initMusic(): Promise<void> {
  const store = await PlaylistStore.load();
  const player = new MusicPlayer(store, $('#ytDock'), $('#ytPlayer'));
  initMix(player);
  initPlaylist(store);
  initPlayer(player);
}

// 絵と音は互いに待たない。片方が失敗しても、もう片方は動かす
void initScene().catch(error => console.error(error));
void initMusic().catch(error => console.error(error));
