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
import { PlotlyChart } from "./PlotlyChart";
import { SectionTitle, Stat } from "./Shell";

const COLORSCALE = "Viridis";

export function StepGraphs({
  analysis,
  onNext,
}: {
  analysis: Analysis | null;
  onNext: () => void;
}) {
  const [response, setResponse] = useState<ResponseKey>("hardness");
  const [fx, setFx] = useState(0);
  const [fy, setFy] = useState(1);

  const names = analysis?.dataset.names ?? [];
  const grid = useMemo(
    () =>
      analysis && fx !== fy ? surfaceGrid(analysis, fx, fy, response, 28) : null,
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
    <section className="panel p-6">
      <SectionTitle
        title="Response Graphs"
        hint="The surface and contour sweep two materials across their full range while the others stay at mid-point."
        right={
          <Button size="lg" onClick={onNext}>
            Optimize formulation <ArrowRight className="size-4" />
          </Button>
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
          <TabsTrigger value="contour">Contour</TabsTrigger>
          <TabsTrigger value="parity">Actual vs predicted</TabsTrigger>
        </TabsList>

        <TabsContent value="surface" className="mt-4">
          {grid ? (
            <PlotlyChart
              height={520}
              data={[
                {
                  type: "surface",
                  x: grid.xs,
                  y: grid.ys,
                  z: grid.z,
                  colorscale: COLORSCALE,
                  contours: { z: { show: true, usecolormap: true, project: { z: true } } },
                  colorbar: { title: { text: `${label} (%)` } },
                },
              ]}
              layout={{
                scene: {
                  xaxis: { title: { text: `${names[fx]} (g)` } },
                  yaxis: { title: { text: `${names[fy]} (g)` } },
                  zaxis: { title: { text: `${label} (%)` } },
                },
                margin: { l: 0, r: 0, t: 10, b: 0 },
              }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="contour" className="mt-4">
          {grid ? (
            <PlotlyChart
              height={480}
              data={[
                {
                  type: "contour",
                  x: grid.xs,
                  y: grid.ys,
                  z: grid.z,
                  colorscale: COLORSCALE,
                  contours: { showlabels: true, labelfont: { size: 10, color: "#0b0f0c" } },
                  colorbar: { title: { text: `${label} (%)` } },
                },
                {
                  type: "scatter",
                  mode: "markers",
                  x: analysis.dataset.gramRows.map((g) => g[fx]),
                  y: analysis.dataset.gramRows.map((g) => g[fy]),
                  marker: { color: "#e8fff0", size: 7, line: { color: "#0b0f0c", width: 1 } },
                  name: "Measured trials",
                },
              ]}
              layout={{
                xaxis: { title: { text: `${names[fx]} (g)` } },
                yaxis: { title: { text: `${names[fy]} (g)` } },
              }}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="parity" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="RSM R²" value={fit.r2.toFixed(3)} />
            <Stat label="RSM RMSE" value={fit.rmse.toFixed(3)} />
            <Stat label="Forest OOB R²" value={forest.oobR2.toFixed(3)} />
          </div>
          <PlotlyChart
            height={460}
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
                marker: { size: 10, color: "#9be15d" },
                name: "RSM",
              },
              {
                type: "scatter",
                mode: "markers",
                x: forest.actual,
                y: forest.fitted,
                marker: { size: 9, color: "#5dc8e1", symbol: "diamond" },
                name: "Random forest",
              },
            ]}
            layout={{
              xaxis: { title: { text: `Measured ${label} (%)` } },
              yaxis: { title: { text: `Predicted ${label} (%)` } },
            }}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}

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
