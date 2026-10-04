import type { Layer, LoadedScene } from './types';

// 開きっぱなしにするサイトなので、描画の負荷を抑える
const MAX_FPS = 12;
const MAX_PIXEL_RATIO = 2;
const FRAME_MS = 1000 / MAX_FPS;

export class SceneRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private layers: Layer[] = [];
  private frame = 0;
  private lastTime = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: LoadedScene,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D が使えません');
    this.ctx = ctx;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${scene.def.title}のイラスト`);

    new ResizeObserver(() => this.resize()).observe(canvas);
    // 画面の拡大率や、解像度の違うモニターへの移動で変わる
    window.addEventListener('resize', () => this.resize());
    // タブが非表示の間は描画を止める（音は止めない）
    document.addEventListener('visibilitychange', () => this.updateLoop());
    this.resize();
  }

  setLayers(layers: Layer[]): void {
    this.layers = layers;
    this.draw();
    this.updateLoop();
  }

  private resize(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    const width = Math.round(this.canvas.clientWidth * ratio);
    const height = Math.round(this.canvas.clientHeight * ratio);
    if (!width || !height) return;
    if (this.canvas.width === width && this.canvas.height === height) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.draw();
  }

  private draw(): void {
    const { ctx, canvas } = this;
    const { def, base } = this.scene;
    const [sceneW, sceneH] = def.size;

    // キャンバスを覆うように拡縮し、はみ出す分は中央を基準に切り落とす（モバイルの 4:3 など）
    const scale = Math.max(canvas.width / sceneW, canvas.height / sceneH);
    const offsetX = (canvas.width - sceneW * scale) / 2;
    const offsetY = (canvas.height - sceneH * scale) / 2;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    ctx.drawImage(base, 0, 0, sceneW, sceneH);
    for (const layer of this.layers) layer.draw(ctx);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (def.edgeFade) this.drawEdgeFade(def.paper, canvas.width * def.edgeFade);
  }

  /** 絵の四辺を紙の色へなじませる */
  private drawEdgeFade(paper: string, size: number): void {
    const { ctx, canvas } = this;
    const { width, height } = canvas;
    const sides: Array<[x0: number, y0: number, x1: number, y1: number, x: number, y: number, w: number, h: number]> = [
      [0, 0, size, 0, 0, 0, size, height],
      [width, 0, width - size, 0, width - size, 0, size, height],
      [0, 0, 0, size, 0, 0, width, size],
      [0, height, 0, height - size, 0, height - size, width, size],
    ];
    for (const [x0, y0, x1, y1, x, y, w, h] of sides) {
      const gradient = ctx.createLinearGradient(x0, y0, x1, y1);
      gradient.addColorStop(0, paper);
      gradient.addColorStop(1, `${paper}00`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, w, h);
    }
  }

  // 動く部品がないとき、タブが非表示のときは、ループを回さない
  private updateLoop(): void {
    const shouldRun = this.layers.length > 0 && !document.hidden;
    if (shouldRun && !this.frame) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    } else if (!shouldRun && this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }

  private tick = (now: number): void => {
    this.frame = requestAnimationFrame(this.tick);
    const delta = now - this.lastTime;
    if (delta < FRAME_MS) return;
    this.lastTime = now;

    let dirty = false;
    for (const layer of this.layers) dirty = layer.update(delta) || dirty;
    if (dirty) this.draw();
  };
}
