import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Analysis } from "@/lib/lumora/analysis";
import { RESPONSES, type ResponseKey } from "@/lib/lumora/types";
import { SectionTitle, Stat } from "./Shell";
import { cn } from "@/lib/utils";

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
const num = (v: number) => (Number.isFinite(v) ? v.toFixed(3) : "—");

export function StepModels({
  analysis,
  onNext,
}: {
  analysis: Analysis | null;
  onNext: () => void;
}) {
  const [active, setActive] = useState<ResponseKey>("hardness");

  if (!analysis) {
    return (
      <section className="panel p-6">
        <SectionTitle
          title="Model Summary"
          hint="Run the data-processing step first to fit the models."
        />
      </section>
    );
  }

  const m = analysis.models[active];
  const best = [
    { name: "RSM (quadratic)", r2: m.rsm.r2, rmse: m.rsm.rmse },
    { name: "Linear regression", r2: m.mlr.r2, rmse: m.mlr.rmse },
    { name: "Random forest", r2: m.forest.oobR2, rmse: m.forest.rmse },
  ].sort((a, b) => b.r2 - a.r2)[0]!;

  return (
    <section className="panel p-6">
      <SectionTitle
        title="Model Summary"
        hint="Every response is modelled four ways. Compare the fit quality before trusting a prediction."
        right={
          <Button size="lg" onClick={onNext}>
            View graphs <ArrowRight className="size-4" />
          </Button>
        }
      />

      <div className="mb-6 overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="bg-panel text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Response</th>
              <th className="px-3 py-2 text-right">RSM R²</th>
              <th className="px-3 py-2 text-right">RSM adj. R²</th>
              <th className="px-3 py-2 text-right">RSM RMSE</th>
              <th className="px-3 py-2 text-right">Linear R²</th>
              <th className="px-3 py-2 text-right">Forest OOB R²</th>
              <th className="px-3 py-2 text-right">Classifier</th>
            </tr>
          </thead>
          <tbody>
            {RESPONSES.map((r) => {
              const mm = analysis.models[r.key];
              return (
                <tr
                  key={r.key}
                  onClick={() => setActive(r.key)}
                  className={cn(
                    "cursor-pointer border-t border-border/60 hover:bg-panel/60",
                    active === r.key && "bg-primary/10",
                  )}
                >
                  <td className="px-3 py-2 font-medium">{r.label}</td>
                  <td className="mono-num px-3 py-2 text-right">{num(mm.rsm.r2)}</td>
                  <td className="mono-num px-3 py-2 text-right">{num(mm.rsm.adjR2)}</td>
                  <td className="mono-num px-3 py-2 text-right">{num(mm.rsm.rmse)}</td>
                  <td className="mono-num px-3 py-2 text-right">{num(mm.mlr.r2)}</td>
                  <td className="mono-num px-3 py-2 text-right">{num(mm.forest.oobR2)}</td>
                  <td className="px-3 py-2 text-right">
                    {mm.classifier.trained ? (
                      <Badge variant="secondary">{pct(mm.classifier.accuracy)}</Badge>
                    ) : (
                      <Badge variant="outline">n/a</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {RESPONSES.map((r) => (
          <button
            key={r.key}
            onClick={() => setActive(r.key)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active === r.key
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="rounded-xl border border-border bg-panel/40 p-4">
          <p className="mb-3 text-sm font-semibold">
            Response surface equation — {RESPONSES.find((r) => r.key === active)!.label}
          </p>
          <div className="max-h-[320px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="py-1.5 text-left">Term (coded)</th>
                  <th className="py-1.5 text-right">Coefficient</th>
                </tr>
              </thead>
              <tbody>
                {m.rsm.terms.map((t, i) => (
                  <tr key={t} className="border-t border-border/50">
                    <td className="py-1.5">{t}</td>
                    <td
                      className={cn(
                        "mono-num py-1.5 text-right",
                        (m.rsm.coefficients[i] ?? 0) < 0 && "text-destructive",
                      )}
                    >
                      {num(m.rsm.coefficients[i] ?? 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Best model" value={<span className="text-sm">{best.name}</span>} />
            <Stat label="Best R²" value={num(best.r2)} />
            <Stat label="Rows used" value={analysis.dataset.completed} />
            <Stat label="Forest RMSE" value={num(m.forest.rmse)} />
          </div>
          <div className="rounded-xl border border-border bg-panel/40 p-4">
            <p className="mb-3 text-sm font-semibold">Material importance (random forest)</p>
            <div className="space-y-2">
              {analysis.dataset.names.map((n, i) => {
                const share = m.forest.importance[i] ?? 0;
                return (
                  <div key={n}>
                    <div className="flex justify-between text-xs">
                      <span>{n}</span>
                      <span className="mono-num text-muted-foreground">{pct(share)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-border/60">
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, share * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {!m.classifier.trained ? (
            <p className="text-xs text-muted-foreground">
              Pass/fail classifier not trained: {m.classifier.reason}.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
