// シーンの定義（docs/plan.md の「シーンの定義」）。layers の中身は段階3で実装する
export interface SceneDef {
  id: string;
  title: string;
  /** UI の差し色 */
  accent: string;
  /** ベース画像の地の色。ページの紙の色をこれに合わせ、絵と紙の境目をなくす */
  paper: string;
  /** 論理解像度。座標はすべてこのピクセル座標 */
  size: [number, number];
  base: string;
  /** 絵の端を紙の色へぼかす幅（絵の幅に対する割合）。0 か省略でぼかさない */
  edgeFade?: number;
  layers: unknown[];
}

export interface LoadedScene {
  def: SceneDef;
  base: HTMLImageElement;
}

/** 絵の上に重ねて動かす部品 */
export interface Layer {
  /** 時間を進める。描き直しが必要なら true */
  update(deltaMs: number): boolean;
  /** シーンの座標系で描く */
  draw(ctx: CanvasRenderingContext2D): void;
}
