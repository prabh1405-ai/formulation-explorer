import { ArrowRight, Download, Eraser, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { downloadCsv, trialsToCsv } from "@/lib/lumora/csv";
import { rng } from "@/lib/lumora/design";
import { RESPONSES, type ResponseKey } from "@/lib/lumora/types";
import type { useLumora } from "@/lib/lumora/store";
import { SectionTitle, Stat } from "./Shell";

/**
 * Result entry table: one row per trial, one numeric column per measured
 * response. Values are percentages (0-100) and stored as soon as they parse.
 */
export function StepResults({
  store,
  onNext,
}: {
  store: ReturnType<typeof useLumora>;
  onNext: () => void;
}) {
  const { state, setResult, clearResults, setState } = store;
  const cells = state.trials.length * RESPONSES.length;
  const filled = state.trials.reduce(
    (n, t) => n + RESPONSES.filter((r) => t.results[r.key] !== null).length,
    0,
  );
  const pct = cells ? Math.round((filled / cells) * 100) : 0;
  const complete = cells > 0 && filled === cells;
  const enough = state.trials.length >= state.materials.length + 2;

  /** Demo data so the analysis pipeline can be exercised without a lab run. */
  const fillExample = () => {
    const rand = rng(state.seed + 991);
    setState((s) => ({
      ...s,
      trials: s.trials.map((t) => {
        const coded = t.levels.map((g, j) => {
          const m = s.materials[j]!;
          const half = (m.max - m.min) / 2 || 1;
          return (g - (m.min + m.max) / 2) / half;
        });
        const mix = (w: number[], base: number, curve: number) =>
          Math.max(
            5,
            Math.min(
              99,
              base +
                coded.reduce((acc, c, j) => acc + c * (w[j % w.length] ?? 6), 0) +
                curve * coded.reduce((acc, c) => acc + c * c, 0) +
                (rand() * 4 - 2),
            ),
          );
        return {
          ...t,
          results: {
            hardness: round1(mix([9, 5, 7, -4], 78, -3)),
            breakResistance: round1(mix([7, 3, 9, -2], 75, -4)),
            flexibility: round1(mix([-4, -2, 3, 11], 70, -3)),
            oilWicking: round1(mix([6, 8, -3, 2], 80, -2)),
            breakdown: round1(mix([-5, 6, -7, 4], 72, -2)),
            weightBalance: round1(mix([3, -6, 4, 5], 82, -3)),
          },
        };
      }),
    }));
  };

  if (state.trials.length === 0) {
    return (
      <section className="panel p-6">
        <SectionTitle
          title="Result Entry"
          hint="Generate an experiment design first — the result table follows the trial list."
        />
      </section>
    );
  }

  return (
    <section className="panel p-6">
      <SectionTitle
        title="Result Entry"
        hint="Record what each prepared plate actually measured. All values are percentages between 0 and 100."
        right={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={fillExample}>
              <Wand2 className="size-4" /> Fill demo values
            </Button>
            <Button variant="outline" size="sm" onClick={clearResults}>
              <Eraser className="size-4" /> Clear
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadCsv(
                  "lumora-results.csv",
                  trialsToCsv(state.materials, state.trials),
                )
              }
            >
              <Download className="size-4" /> Export CSV
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Trials" value={state.trials.length} />
        <Stat label="Values entered" value={`${filled} / ${cells}`} />
        <Stat label="Completion" value={`${pct}%`} />
      </div>
      <Progress value={pct} className="mb-6 h-2" />

      <div className="max-h-[520px] overflow-auto rounded-xl border border-border">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 z-10 bg-panel text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Trial</th>
              {state.materials.map((m) => (
                <th key={m.id} className="px-3 py-2 text-right font-medium">
                  {m.name} (g)
                </th>
              ))}
              {RESPONSES.map((r) => (
                <th key={r.key} className="px-3 py-2 text-center font-medium text-primary">
                  {r.label} (%)
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state.trials.map((t) => (
              <tr key={t.trial} className="border-t border-border/60">
                <td className="px-3 py-2 font-medium">#{t.trial}</td>
                {t.levels.map((v, j) => (
                  <td key={j} className="mono-num px-3 py-2 text-right text-muted-foreground">
                    {v.toFixed(2)}
                  </td>
                ))}
                {RESPONSES.map((r) => (
                  <td key={r.key} className="px-1.5 py-1.5">
                    <ResultCell
                      value={t.results[r.key]}
                      onChange={(v) => setResult(t.trial, r.key, v)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button size="lg" disabled={!complete || !enough} onClick={onNext}>
          Process data <ArrowRight className="size-4" />
        </Button>
        {!complete ? (
          <p className="text-xs text-muted-foreground">
            {cells - filled} value{cells - filled === 1 ? "" : "s"} still missing.
          </p>
        ) : !enough ? (
          <p className="text-xs text-destructive">
            At least {state.materials.length + 2} trials are needed to fit the models.
          </p>
        ) : (
          <p className="text-xs text-primary">All measurements captured.</p>
        )}
      </div>
    </section>
  );
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function ResultCell({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const invalid = value !== null && (value < 0 || value > 100);
  return (
    <Input
      type="number"
      inputMode="decimal"
      step="0.1"
      min={0}
      max={100}
      value={value ?? ""}
      placeholder="—"
      onChange={(e) => {
        const raw = e.target.value;
        onChange(raw === "" ? null : Number(raw));
      }}
      className={`mono-num h-9 w-24 text-center ${
        invalid ? "border-destructive" : value === null ? "border-dashed" : ""
      }`}
    />
  );
}

export type { ResponseKey };
