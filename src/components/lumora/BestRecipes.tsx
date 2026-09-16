import { useMemo, useState } from "react";
import { ChefHat, Download, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { optimize, type Analysis, type Candidate } from "@/lib/lumora/analysis";
import { downloadCsv } from "@/lib/lumora/csv";
import { RESPONSES, type ObjectiveSpec, type ResponseKey } from "@/lib/lumora/types";
import { cn } from "@/lib/utils";

const PLACE = ["Best recipe", "Runner-up recipe", "Third recipe"];

/**
 * Builds a numbered preparation sequence for one candidate blend. Materials are
 * added heaviest-first so the dry bulk goes in before binder and plasticiser.
 */
function preparationSteps(names: string[], grams: number[], rank: number): string[] {
  const order = names
    .map((name, i) => ({ name, g: grams[i] ?? 0 }))
    .sort((a, b) => b.g - a.g);
  const total = grams.reduce((a, b) => a + b, 0);
  const soak = [20, 25, 15][rank - 1] ?? 20;
  const press = [8, 10, 6][rank - 1] ?? 8;
  const dry = [60, 55, 65][rank - 1] ?? 60;

  return [
    `Weigh out every material on a 0.01 g scale — total batch ${total.toFixed(2)} g.`,
    `Soak ${order[0]!.name} (${order[0]!.g.toFixed(2)} g) in warm water for ${soak} minutes, then drain well.`,
    ...order
      .slice(1)
      .map(
        (o, i) =>
          `Blend in ${o.name} (${o.g.toFixed(2)} g) and mix for ${2 + i} minutes until evenly spread.`,
      ),
    `Knead the slurry into a uniform dough with no dry pockets.`,
    `Press the dough into the mould at moderate pressure for ${press} minutes.`,
    `Dry at ${dry} °C until the weight stops changing (roughly 4-6 hours), then cool before testing.`,
  ];
}

export function BestRecipes({
  analysis,
  objectives,
  seed,
}: {
  analysis: Analysis;
  objectives: Record<ResponseKey, ObjectiveSpec>;
  seed: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const candidates = useMemo<Candidate[]>(
    () => (open ? optimize(analysis, objectives, seed + 7) : []),
    [open, analysis, objectives, seed],
  );

  const names = analysis.dataset.names;
  const best = candidates[active];

  const exportCsv = () => {
    if (!candidates.length) return;
    const header = [
      "Rank",
      ...names.map((n) => `${n} (g)`),
      ...RESPONSES.map((r) => `${r.label} (%)`),
      "Overall (%)",
    ];
    const rows = candidates.map((c) => [
      c.rank,
      ...c.grams,
      ...RESPONSES.map((r) => c.predicted[r.key].toFixed(1)),
      c.overall.toFixed(1),
    ]);
    downloadCsv(
      "lumora-top3-recipes.csv",
      [header, ...rows].map((r) => r.join(",")).join("\n"),
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg">
          <ChefHat className="size-4" /> Get the best recipe result
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-auto">
        <DialogHeader>
          <DialogTitle>Top 3 recipes</DialogTitle>
          <DialogDescription>
            Ranked by overall desirability across every measured property. Each recipe
            has its own step-by-step preparation order.
          </DialogDescription>
        </DialogHeader>

        {!candidates.length ? (
          <p className="py-6 text-sm text-muted-foreground">Searching the models…</p>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {candidates.map((c, i) => (
                <button
                  key={c.rank}
                  onClick={() => setActive(i)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                    active === i
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Medal className="size-3.5" /> {PLACE[i] ?? `Recipe ${c.rank}`}
                  <span className="mono-num">{c.overall.toFixed(1)}%</span>
                </button>
              ))}
            </div>

            {best ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-panel/50 p-4">
                  <p className="mb-3 text-sm font-semibold">Grams of each material</p>
                  <ul className="space-y-2">
                    {names.map((n, i) => (
                      <li
                        key={n + i}
                        className="flex items-center justify-between border-b border-border/50 pb-2 text-sm last:border-0 last:pb-0"
                      >
                        <span>{n}</span>
                        <span className="mono-num font-semibold text-primary">
                          {best.grams[i]!.toFixed(2)} g
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mono-num mt-3 text-xs text-muted-foreground">
                    Total {best.grams.reduce((a, b) => a + b, 0).toFixed(2)} g
                  </p>
                  <div className="mt-4 space-y-2">
                    {RESPONSES.map((r) => (
                      <div key={r.key} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{r.label}</span>
                        <span className="mono-num">
                          {best.predicted[r.key].toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-panel/50 p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    Preparation order
                    <Badge variant="outline">{PLACE[active] ?? ""}</Badge>
                  </p>
                  <ol className="space-y-2.5">
                    {preparationSteps(names, best.grams, best.rank).map((s, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="mono-num grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground">{s}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download className="size-4" /> Export the 3 recipes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
