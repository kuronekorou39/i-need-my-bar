import './style.css';
import { CAFE_WINDOW, showScene } from './scene';
import { initDrawer } from './ui/drawer';
import { initMix } from './ui/mix';
import { initPlayer } from './ui/player';
import { initPlaylist } from './ui/playlist';

showScene(CAFE_WINDOW);
initDrawer();
initMix();
initPlayer(initPlaylist());
