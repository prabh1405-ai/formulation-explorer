import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { surfaceGrid, type Analysis } from "@/lib/lumora/analysis";
import { RESPONSES, type ResponseKey } from "@/lib/lumora/types";
import type { useLumora } from "@/lib/lumora/store";
import { PlotlyChart } from "./PlotlyChart";
import { BestRecipes } from "./BestRecipes";
import { SectionTitle, Stat } from "./Shell";

/** Vibrant brand ramp: deep violet -> violet -> pink -> orange -> yellow. */
const COLORSCALE: [number, string][] = [
  [0, "#2d0b5a"],
  [0.2, "#7b2ff7"],
  [0.4, "#c94ddb"],
  [0.6, "#ff5fa2"],
  [0.8, "#ff9d3f"],
  [1, "#ffe94d"],
];

export function StepGraphs({
  analysis,
  store,
  onNext,
}: {
  analysis: Analysis | null;
  store: ReturnType<typeof useLumora>;
  onNext: () => void;
}) {
  const [response, setResponse] = useState<ResponseKey>("hardness");
  const [fx, setFx] = useState(0);
  const [fy, setFy] = useState(1);

  const names = analysis?.dataset.names ?? [];
  const grid = useMemo(
    () =>
      analysis && fx !== fy ? surfaceGrid(analysis, fx, fy, response, 48) : null,
    [analysis, fx, fy, response],
  );

  if (!analysis) {
    return (
      <section className="panel p-6">
        <SectionTitle
          title="Response Graphs"
          hint="Run the data-processing step first — the plots are drawn from the fitted models."
        />
      </section>
    );
  }

  const fit = analysis.models[response].rsm;
  const forest = analysis.models[response].forest;
  const label = RESPONSES.find((r) => r.key === response)!.label;
  const lo = Math.min(...fit.actual, ...fit.fitted);
  const hi = Math.max(...fit.actual, ...fit.fitted);

  return (
    <section className="panel grid-bg p-6">
      <SectionTitle
        title="Response Graphs"
        hint="The surface and contour sweep two materials across their full range while the others stay at mid-point."
        right={
          <div className="flex flex-wrap gap-2">
            <BestRecipes
              analysis={analysis}
              objectives={store.state.objectives}
              seed={store.state.seed}
            />
            <Button size="lg" onClick={onNext}>
              Optimize formulation <ArrowRight className="size-4" />
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div>
          <Label>Response</Label>
          <Select value={response} onValueChange={(v) => setResponse(v as ResponseKey)}>
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESPONSES.map((r) => (
                <SelectItem key={r.key} value={r.key}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <FactorSelect label="X axis material" value={fx} onChange={setFx} names={names} />
        <FactorSelect label="Y axis material" value={fy} onChange={setFy} names={names} />
      </div>

      {fx === fy ? (
        <p className="mb-4 text-sm text-destructive">
          Pick two different materials for the X and Y axes.
        </p>
      ) : null}

      <Tabs defaultValue="surface">
        <TabsList>
          <TabsTrigger value="surface">3D surface</TabsTrigger>
          <TabsTrigger value="contour">Contour map</TabsTrigger>
          <TabsTrigger value="parity">Model accuracy</TabsTrigger>
        </TabsList>

        <TabsContent value="surface" className="mt-4">
          {grid ? (
            <div className="overflow-hidden rounded-2xl border border-primary/20 bg-panel/40 p-2 shadow-[0_24px_60px_-40px_oklch(0.83_0.19_132/0.6)]">
              <PlotlyChart
                height={560}
                data={[
                  {
                    type: "surface",
                    x: grid.xs,
                    y: grid.ys,
                    z: grid.z,
                    colorscale: COLORSCALE,
                    opacity: 0.97,
                    lighting: {
                      ambient: 0.62,
                      diffuse: 0.9,
                      specular: 0.35,
                      roughness: 0.45,
                      fresnel: 0.25,
                    },
                    lightposition: { x: 120, y: 200, z: 160 },
                    hovertemplate: `${names[fx]}: %{x:.2f} g<br>${names[fy]}: %{y:.2f} g<br>${label}: %{z:.1f}%<extra></extra>`,
                    contours: {
                      z: {
                        show: true,
                        usecolormap: true,
                        project: { z: true },
                        width: 3,
                        highlightcolor: "#ffe94d",
                      },
                    },
                    colorbar: {
                      title: { text: `${label} (%)` },
                      thickness: 14,
                      outlinewidth: 0,
                      len: 0.75,
                    },
                  },
                ]}
                layout={{
                  scene: {
                    camera: { eye: { x: 1.55, y: -1.5, z: 0.85 } },
                    aspectratio: { x: 1, y: 1, z: 0.72 },
                    xaxis: sceneAxis(`${names[fx]} (g)`),
                    yaxis: sceneAxis(`${names[fy]} (g)`),
                    zaxis: sceneAxis(`${label} (%)`),
                  },
                  margin: { l: 0, r: 0, t: 10, b: 0 },
                }}
              />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="contour" className="mt-4">
          {grid ? (
            <div className="overflow-hidden rounded-2xl border border-primary/20 bg-panel/40 p-2">
              <PlotlyChart
                height={520}
                data={[
                  {
                    type: "contour",
                    x: grid.xs,
                    y: grid.ys,
                    z: grid.z,
                    colorscale: COLORSCALE,
                    line: { smoothing: 1.3, width: 1 },
                    hovertemplate: `${names[fx]}: %{x:.2f} g<br>${names[fy]}: %{y:.2f} g<br>${label}: %{z:.1f}%<extra></extra>`,
                    contours: {
                      showlabels: true,
                      labelfont: { size: 10, color: "#04140e" },
                    },
                    colorbar: {
                      title: { text: `${label} (%)` },
                      thickness: 14,
                      outlinewidth: 0,
                      len: 0.85,
                    },
                  },
                  {
                    type: "scatter",
                    mode: "markers",
                    x: analysis.dataset.gramRows.map((g) => g[fx]),
                    y: analysis.dataset.gramRows.map((g) => g[fy]),
                    marker: {
                      color: "#e8fff0",
                      size: 9,
                      symbol: "circle",
                      line: { color: "#04140e", width: 1.5 },
                    },
                    name: "Measured trials",
                  },
                ]}
                layout={{
                  xaxis: flatAxis(`${names[fx]} (g)`),
                  yaxis: flatAxis(`${names[fy]} (g)`),
                }}
              />
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="parity" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="RSM R²" value={fit.r2.toFixed(3)} />
            <Stat label="RSM RMSE" value={fit.rmse.toFixed(3)} />
            <Stat label="Forest OOB R²" value={forest.oobR2.toFixed(3)} />
          </div>
          <div className="overflow-hidden rounded-2xl border border-primary/20 bg-panel/40 p-2">
            <PlotlyChart
              height={480}
              data={[
                {
                  type: "scatter",
                  mode: "lines",
                  x: [lo, hi],
                  y: [lo, hi],
                  line: { color: "#7a8c80", dash: "dash" },
                  name: "Perfect fit",
                },
                {
                  type: "scatter",
                  mode: "markers",
                  x: fit.actual,
                  y: fit.fitted,
                  marker: {
                    size: 12,
                    color: "#9be15d",
                    opacity: 0.9,
                    line: { color: "#04140e", width: 1 },
                  },
                  name: "RSM",
                },
                {
                  type: "scatter",
                  mode: "markers",
                  x: forest.actual,
                  y: forest.fitted,
                  marker: {
                    size: 11,
                    color: "#5dc8e1",
                    symbol: "diamond",
                    opacity: 0.9,
                    line: { color: "#04140e", width: 1 },
                  },
                  name: "Random forest",
                },
              ]}
              layout={{
                xaxis: flatAxis(`Measured ${label} (%)`),
                yaxis: flatAxis(`Predicted ${label} (%)`),
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

const sceneAxis = (text: string) => ({
  title: { text },
  gridcolor: "rgba(155,225,93,0.18)",
  zerolinecolor: "rgba(155,225,93,0.35)",
  backgroundcolor: "rgba(0,0,0,0)",
  showbackground: true,
});

const flatAxis = (text: string) => ({
  title: { text },
  gridcolor: "rgba(155,225,93,0.12)",
  zerolinecolor: "rgba(155,225,93,0.3)",
});

function FactorSelect({
  label,
  value,
  onChange,
  names,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  names: string[];
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="mt-1.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {names.map((n, i) => (
            <SelectItem key={n + i} value={String(i)}>
              {n}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
