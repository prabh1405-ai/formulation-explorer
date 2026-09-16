import { useState } from "react";
import { Award, Download, Loader2, Sparkles, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { optimize, qualityCheck, type Analysis, type Candidate } from "@/lib/lumora/analysis";
import { downloadCsv } from "@/lib/lumora/csv";
import { RESPONSES, type Objective, type ResponseKey } from "@/lib/lumora/types";
import type { useLumora } from "@/lib/lumora/store";
import { SectionTitle, Stat } from "./Shell";
import { cn } from "@/lib/utils";

const GOALS: { value: Objective; label: string }[] = [
  { value: "max", label: "Maximise" },
  { value: "min", label: "Minimise" },
  { value: "target", label: "Hit target" },
];

export function StepOptimize({
  store,
  analysis,
}: {
  store: ReturnType<typeof useLumora>;
  analysis: Analysis | null;
}) {
  const { state, setObjective } = store;
  const [running, setRunning] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState(0);

  if (!analysis) {
    return (
      <section className="panel p-6">
        <SectionTitle
          title="Optimization"
          hint="Run the data-processing step first — optimisation searches the fitted models."
        />
      </section>
    );
  }

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      try {
        const result = optimize(analysis, state.objectives, state.seed + 7);
        setCandidates(result);
        setSelected(0);
      } finally {
        setRunning(false);
      }
    }, 30);
  };

  const best = candidates?.[selected] ?? null;
  const checks = best ? qualityCheck(analysis, best.grams) : null;

  const exportCsv = () => {
    if (!candidates) return;
    const header = [
      "Rank",
      ...state.materials.map((m) => `${m.name} (g)`),
      ...RESPONSES.map((r) => `${r.label} (%)`),
      "Overall desirability (%)",
    ];
    const rows = candidates.map((c) => [
      c.rank,
      ...c.grams,
      ...RESPONSES.map((r) => c.predicted[r.key].toFixed(1)),
      c.overall.toFixed(1),
    ]);
    downloadCsv(
      "lumora-recommendations.csv",
      [header, ...rows].map((r) => r.join(",")).join("\n"),
    );
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <SectionTitle
          title="Optimization Goals"
          hint="Set what each property should do, the value you are aiming for, the minimum you will accept, and how much it matters."
          right={
            <Button size="lg" onClick={run} disabled={running}>
              {running ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              {running ? "Searching…" : "Find best formulations"}
            </Button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          {RESPONSES.map((r) => {
            const spec = state.objectives[r.key];
            return (
              <div key={r.key} className="rounded-xl border border-border bg-panel/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">{r.label}</p>
                  <Badge variant="outline" className="mono-num">
                    weight {spec.weight.toFixed(1)}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Goal</Label>
                    <Select
                      value={spec.goal}
                      onValueChange={(v) => setObjective(r.key, { goal: v as Objective })}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GOALS.map((g) => (
                          <SelectItem key={g.value} value={g.value}>
                            {g.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Target %</Label>
                    <Input
                      type="number"
                      className="mono-num mt-1.5"
                      value={spec.target}
                      onChange={(e) =>
                        setObjective(r.key, { target: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Min accept %</Label>
                    <Input
                      type="number"
                      className="mono-num mt-1.5"
                      value={spec.threshold}
                      onChange={(e) =>
                        setObjective(r.key, { threshold: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label className="text-xs">Importance</Label>
                  <Slider
                    className="mt-3"
                    min={0.2}
                    max={3}
                    step={0.1}
                    value={[spec.weight]}
                    onValueChange={([v]) => setObjective(r.key, { weight: v ?? 1 })}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {candidates && candidates.length > 0 && best ? (
        <>
          <section className="panel grid-bg p-6">
            <SectionTitle
              title="Recommended Formulation"
              hint="Top-ranked blend by weighted desirability across every property."
              right={
                <Button variant="outline" onClick={exportCsv}>
                  <Download className="size-4" /> Export recommendations
                </Button>
              }
            />

            <div className="mb-5 flex flex-wrap gap-2">
              {candidates.map((c, i) => (
                <button
                  key={c.rank}
                  onClick={() => setSelected(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    selected === i
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Award className="size-3.5" /> Option {c.rank}
                  <span className="mono-num">{c.overall.toFixed(1)}%</span>
                </button>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
              <div className="space-y-3">
                <Stat
                  label="Overall desirability"
                  value={`${best.overall.toFixed(1)}%`}
                />
                <div className="rounded-xl border border-border bg-panel/50 p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Target className="size-4 text-primary" /> Mix these amounts
                  </p>
                  <ul className="space-y-2">
                    {state.materials.map((m, i) => (
                      <li
                        key={m.id}
                        className="flex items-center justify-between border-b border-border/50 pb-2 text-sm last:border-0 last:pb-0"
                      >
                        <span>{m.name}</span>
                        <span className="mono-num font-semibold text-primary">
                          {best.grams[i]!.toFixed(2)} g
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mono-num mt-3 text-xs text-muted-foreground">
                    Total {best.grams.reduce((a, b) => a + b, 0).toFixed(2)} g
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-panel/50 p-4">
                <p className="mb-3 text-sm font-semibold">Predicted performance</p>
                <div className="space-y-3">
                  {RESPONSES.map((r) => {
                    const value = best.predicted[r.key];
                    const d = best.perResponse[r.key];
                    return (
                      <div key={r.key}>
                        <div className="flex justify-between text-xs">
                          <span>{r.label}</span>
                          <span className="mono-num">
                            {value.toFixed(1)}% · desirability {(d * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-border/60">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${Math.min(100, value)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <SectionTitle
              title="Quality Check"
              hint="Each trained classifier judges whether this blend is likely to clear your minimum acceptable value."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {checks!.map((c) => (
                <div
                  key={c.key}
                  className={cn(
                    "rounded-xl border p-4",
                    c.pass === null
                      ? "border-border bg-panel/40"
                      : c.pass
                        ? "border-primary/40 bg-primary/10"
                        : "border-destructive/40 bg-destructive/10",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{c.label}</p>
                    <Badge
                      variant={c.pass === null ? "outline" : c.pass ? "default" : "destructive"}
                    >
                      {c.pass === null ? "unknown" : c.pass ? "pass" : "at risk"}
                    </Badge>
                  </div>
                  <p className="mono-num mt-2 text-lg font-semibold">
                    {c.value.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {c.trained
                      ? `confidence ${(c.probability * 100).toFixed(0)}% · model accuracy ${(c.accuracy * 100).toFixed(0)}%`
                      : c.reason}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="panel p-6">
            <SectionTitle title="All Candidates" />
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-panel text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left">Rank</th>
                    {state.materials.map((m) => (
                      <th key={m.id} className="px-3 py-2 text-right">
                        {m.name} (g)
                      </th>
                    ))}
                    {RESPONSES.map((r) => (
                      <th key={r.key} className="px-3 py-2 text-right">
                        {r.label}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right text-primary">Overall</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => (
                    <tr
                      key={c.rank}
                      onClick={() => setSelected(i)}
                      className={cn(
                        "cursor-pointer border-t border-border/60 hover:bg-panel/60",
                        selected === i && "bg-primary/10",
                      )}
                    >
                      <td className="px-3 py-2 font-medium">#{c.rank}</td>
                      {c.grams.map((g, j) => (
                        <td key={j} className="mono-num px-3 py-2 text-right">
                          {g.toFixed(2)}
                        </td>
                      ))}
                      {RESPONSES.map((r) => (
                        <td key={r.key} className="mono-num px-3 py-2 text-right">
                          {c.predicted[r.key].toFixed(1)}
                        </td>
                      ))}
                      <td className="mono-num px-3 py-2 text-right font-semibold text-primary">
                        {c.overall.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <section className="panel p-6 text-sm text-muted-foreground">
          Set your goals above, then run the search to see the top formulations.
        </section>
      )}
    </div>
  );
}

export type { ResponseKey };
