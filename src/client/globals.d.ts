/** Tipagem minima da biblioteca Chart.js carregada globalmente em /vendor/chart.umd.js. */
interface ChartInstance {
  destroy(): void;
}

interface ChartConstructor {
  new (canvas: HTMLCanvasElement, config: unknown): ChartInstance;
}

declare const Chart: ChartConstructor | undefined;
