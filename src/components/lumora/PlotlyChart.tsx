import { useEffect, useRef } from "react";

type Props = {
  data: unknown[];
  layout?: Record<string, unknown>;
  height?: number;
};

const baseLayout = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { color: "#d9e6dc", family: "'DM Sans', sans-serif", size: 12 },
  margin: { l: 55, r: 20, t: 30, b: 50 },
  legend: { orientation: "h" as const, y: -0.2 },
};

/** Plotly is browser-only: it is imported after hydration, never during SSR. */
export function PlotlyChart({ data, layout, height = 420 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let el: HTMLDivElement | null = ref.current;
    let cancelled = false;
    void (async () => {
      const Plotly = (await import("plotly.js-dist-min")).default;
      if (cancelled || !el) return;
      await Plotly.newPlot(el, data, { ...baseLayout, ...layout }, {
        displaylogo: false,
        responsive: true,
      });
    })();
    return () => {
      cancelled = true;
      if (el) {
        void import("plotly.js-dist-min").then((m) => el && m.default.purge(el));
      }
      el = null;
    };
  }, [data, layout]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
