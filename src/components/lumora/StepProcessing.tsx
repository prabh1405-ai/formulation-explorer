import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { buildDataset, runAnalysis, type Analysis } from "@/lib/lumora/analysis";
import type { useLumora } from "@/lib/lumora/store";
import { SectionTitle, Stat } from "./Shell";
import { cn } from "@/lib/utils";

const STAGES = [
  "Validating measured results",
  "Coding factors to the design space",
  "Fitting response surface (RSM) models",
  "Fitting linear regression baselines",
  "Growing random forest ensembles",
  "Training pass / fail classifiers",
  "Scoring model quality",
] as const;

export function StepProcessing({
  store,
  analysis,
  onAnalysis,
  onNext,
}: {
  store: ReturnType<typeof useLumora>;
  analysis: Analysis | null;
  onAnalysis: (a: Analysis) => void;
  onNext: () => void;
}) {
  const { state } = store;
  const dataset = buildDataset(state.materials, state.trials);
  const [stage, setStage] = useState(analysis ? STAGES.length : -1);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const run = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setError(null);
    setStage(0);
    STAGES.forEach((_, i) => {
      timers.current.push(
        setTimeout(() => {
          setStage(i + 1);
          if (i === STAGES.length - 1) {
            try {
              onAnalysis(runAnalysis(state.materials, state.trials, state.objectives));
            } catch (e) {
              setError(e instanceof Error ? e.message : "Processing failed.");
              setStage(-1);
            }
          }
        }, 320 * (i + 1)),
      );
    });
  }, [onAnalysis, state.materials, state.objectives, state.trials]);

  useEffect(() => {
    if (dataset.ready && !analysis) run();
    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const done = stage >= STAGES.length && !error;
  const pct = Math.round((Math.max(0, stage) / STAGES.length) * 100);

  return (
    <section className="panel grid-bg p-6">
      <SectionTitle
        title="Data Processing"
        hint="Your measurements are checked, coded and passed through every model in the pipeline."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Stat label="Trials" value={dataset.total} />
        <Stat label="Complete rows" value={dataset.completed} />
        <Stat label="Factors" value={state.materials.length} />
        <Stat label="Missing values" value={dataset.missing.length} />
      </div>

      {!dataset.ready ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle className="size-4" /> The dataset is not ready to model
          </p>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            {dataset.missing.length ? (
              <li>
                {dataset.missing.length} measurement
                {dataset.missing.length === 1 ? " is" : "s are"} still empty (first:
                trial #{dataset.missing[0]!.trial}, {dataset.missing[0]!.response}).
              </li>
            ) : null}
            {dataset.completed < state.materials.length + 2 ? (
              <li>
                At least {state.materials.length + 2} fully measured trials are needed for{" "}
                {state.materials.length} materials.
              </li>
            ) : null}
          </ul>
        </div>
      ) : (
        <>
          <Progress value={done ? 100 : pct} className="mb-6 h-2" />
          <ol className="space-y-2">
            {STAGES.map((label, i) => {
              const state_ = stage > i ? "done" : stage === i ? "active" : "idle";
              return (
                <li
                  key={label}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors",
                    state_ === "done"
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : state_ === "active"
                        ? "border-border bg-panel/70 text-foreground"
                        : "border-border/60 bg-panel/30 text-muted-foreground",
                  )}
                >
                  {state_ === "done" ? (
                    <Check className="size-4 text-primary" />
                  ) : state_ === "active" ? (
                    <Loader2 className="size-4 animate-spin text-primary" />
                  ) : (
                    <span className="mono-num w-4 text-center text-xs">{i + 1}</span>
                  )}
                  {label}
                </li>
              );
            })}
          </ol>

          {error ? (
            <p className="mt-4 text-sm text-destructive">{error}</p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" disabled={!done} onClick={onNext}>
              View model summary <ArrowRight className="size-4" />
            </Button>
            <Button variant="outline" onClick={run}>
              <RotateCcw className="size-4" /> Re-run processing
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
