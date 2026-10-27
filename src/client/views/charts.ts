/** Wrapper fino sobre o Chart.js global, com destruicao segura ao re-renderizar. */

const instances = new Map<string, ChartInstance>();

export function renderChart(key: string, canvas: HTMLCanvasElement, config: unknown): void {
  instances.get(key)?.destroy();
  instances.delete(key);
  if (typeof Chart === "undefined") {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#64748B";
      ctx.fillText("Biblioteca de graficos indisponivel.", 10, 30);
    }
    return;
  }
  instances.set(key, new Chart(canvas, config));
}

export function destroyAllCharts(): void {
  instances.forEach((c) => c.destroy());
  instances.clear();
}

const moneyTick = (value: number | string): string =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const moneyLabel = (ctx: { dataset: { label?: string }; parsed: number | { y: number } }): string => {
  const v = typeof ctx.parsed === "number" ? ctx.parsed : ctx.parsed.y;
  const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
  return label + v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const baseFont = { family: "Inter, 'Segoe UI', system-ui, sans-serif", size: 12 };

export function doughnutConfig(labels: string[], values: number[], colors: string[]): unknown {
  return {
    type: "doughnut",
    data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: "#ffffff", hoverOffset: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: baseFont, padding: 14 } },
        tooltip: {
          callbacks: {
            label: (ctx: { label: string; parsed: number }) =>
              `${ctx.label}: ${ctx.parsed.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
          },
        },
      },
    },
  };
}

export function barConfig(
  labels: string[],
  datasets: Array<{ label: string; data: number[]; color?: string; backgroundColor?: string[] }>,
  stacked = false
): unknown {
  return {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d) => ({
        label: d.label,
        data: d.data,
        backgroundColor: d.backgroundColor ?? d.color,
        borderRadius: 6,
        maxBarThickness: 34,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { stacked, grid: { display: false }, ticks: { font: baseFont, color: "#64748B" } },
        y: { stacked, beginAtZero: true, grid: { color: "#EEF2F6" }, border: { display: false }, ticks: { font: baseFont, color: "#64748B", callback: moneyTick } },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: baseFont } },
        tooltip: { callbacks: { label: moneyLabel } },
      },
    },
  };
}

export function trendConfig(labels: string[], datasets: Array<{ label: string; data: number[]; color: string; type: "bar" | "line" }>): unknown {
  return {
    type: "bar",
    data: {
      labels,
      datasets: datasets.map((d) =>
        d.type === "line"
          ? { type: "line", label: d.label, data: d.data, borderColor: d.color, backgroundColor: d.color, tension: 0.35, pointRadius: 3, borderWidth: 2, order: 0 }
          : { type: "bar", label: d.label, data: d.data, backgroundColor: d.color, borderRadius: 5, maxBarThickness: 22, order: 1 }
      ),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { font: baseFont, color: "#64748B" } },
        y: { grid: { color: "#EEF2F6" }, border: { display: false }, ticks: { font: baseFont, color: "#64748B", callback: moneyTick } },
      },
      plugins: {
        legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: baseFont } },
        tooltip: { callbacks: { label: moneyLabel } },
      },
    },
  };
}
