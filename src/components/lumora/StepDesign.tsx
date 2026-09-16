import { ArrowRight, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { designRunCount } from "@/lib/lumora/design";
import { downloadCsv, trialsToCsv } from "@/lib/lumora/csv";
import type { DesignKind } from "@/lib/lumora/types";
import type { useLumora } from "@/lib/lumora/store";
import { SectionTitle, Stat } from "./Shell";
import { useState } from "react";

const OPTIONS: { value: DesignKind; label: string; note: string }[] = [
  {
    value: "simple10",
    label: "Generate 10 formulations",
    note: "Space-filling (Latin hypercube) design — every factor range is evenly covered.",
  },
  {
    value: "ccd",
    label: "Central Composite Design",
    note: "Face-centred CCD: full factorial + axial + centre runs. Supports curvature estimation.",
  },
  {
    value: "bbd",
    label: "Box-Behnken Design",
    note: "Rotatable 3-level design that avoids extreme corner combinations.",
  },
];

export function StepDesign({
  store,
  onNext,
}: {
  store: ReturnType<typeof useLumora>;
  onNext: () => void;
}) {
  const { state, generate } = store;
  const [kind, setKind] = useState<DesignKind>(state.design);
  const [seed, setSeed] = useState(state.seed);
  const k = state.materials.length;

  return (
    <section className="panel p-6">
      <SectionTitle
        title="Experiment Design"
        hint="The design is generated from your ranges with a fixed seed, so the same seed always reproduces the same experiment plan."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-5">
          <RadioGroup
            value={kind}
            onValueChange={(v) => setKind(v as DesignKind)}
            className="space-y-3"
          >
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className="flex cursor-pointer gap-3 rounded-xl border border-border bg-panel/50 p-4 has-[:checked]:border-primary/60 has-[:checked]:bg-primary/10"
              >
                <RadioGroupItem value={o.value} className="mt-1" />
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {o.note}
                  </span>
                  <span className="mono-num mt-1 block text-xs text-primary">
                    {designRunCount(o.value, k)} runs
                  </span>
                </span>
              </label>
            ))}
          </RadioGroup>

          <div className="max-w-[10rem]">
            <Label htmlFor="seed">Design seed</Label>
            <Input
              id="seed"
              type="number"
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value) || 0)}
              className="mono-num mt-1.5"
            />
          </div>

          <Button onClick={() => generate(kind, seed)} className="w-full" size="lg">
            <RefreshCw className="size-4" /> Generate formulations
          </Button>
        </div>

        <div className="min-w-0">
          {state.trials.length === 0 ? (
            <div className="grid h-full place-items-center rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              No design yet. Choose a design type and generate the formulation table.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Runs" value={state.trials.length} />
                <Stat label="Factors" value={k} />
                <Stat label="Seed" value={state.seed} />
              </div>
              <div className="max-h-[420px] overflow-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-panel text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Trial</th>
                      {state.materials.map((m) => (
                        <th key={m.id} className="px-3 py-2 text-right">
                          {m.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.trials.map((t) => (
                      <tr key={t.trial} className="border-t border-border/60">
                        <td className="px-3 py-2 font-medium">#{t.trial}</td>
                        {t.levels.map((v, j) => (
                          <td key={j} className="mono-num px-3 py-2 text-right">
                            {v.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={onNext} size="lg">
                  Enter measured results <ArrowRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    downloadCsv(
                      "lumora-design.csv",
                      trialsToCsv(state.materials, state.trials),
                    )
                  }
                >
                  <Download className="size-4" /> Worksheet CSV
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Print or export this table, prepare each plate physically, then record what
                you measure.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
