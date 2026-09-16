import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionTitle } from "./Shell";
import type { useLumora } from "@/lib/lumora/store";

export function StepMaterials({
  store,
  onNext,
}: {
  store: ReturnType<typeof useLumora>;
  onNext: () => void;
}) {
  const { state, setMaterialCount, updateMaterial } = store;
  const invalid = state.materials.some(
    (m) => !m.name.trim() || !(m.max > m.min) || m.min < 0,
  );

  return (
    <section className="panel grid-bg p-6">
      <SectionTitle
        title="Material Input"
        hint="Define each raw material and the gram range you can physically work with. The design space never leaves these bounds."
      />

      <div className="mb-6 max-w-xs">
        <Label htmlFor="count">Number of Materials</Label>
        <Input
          id="count"
          type="number"
          min={2}
          max={8}
          value={state.materials.length}
          onChange={(e) => {
            const n = Math.max(2, Math.min(8, Number(e.target.value) || 2));
            setMaterialCount(n);
          }}
          className="mono-num mt-2"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {state.materials.map((m, i) => (
          <div key={m.id} className="rounded-xl border border-border bg-panel/50 p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary">
              Material {i + 1}
            </p>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={m.name}
                  onChange={(e) => updateMaterial(i, { name: e.target.value })}
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Minimum (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={m.min}
                    onChange={(e) => updateMaterial(i, { min: Number(e.target.value) })}
                    className="mono-num mt-1.5"
                  />
                </div>
                <div>
                  <Label>Maximum (g)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={m.max}
                    onChange={(e) => updateMaterial(i, { max: Number(e.target.value) })}
                    className="mono-num mt-1.5"
                  />
                </div>
              </div>
              {m.max <= m.min ? (
                <p className="text-xs text-destructive">Maximum must exceed minimum.</p>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <Button size="lg" disabled={invalid} onClick={onNext}>
          Continue to experiment design <ArrowRight className="size-4" />
        </Button>
        <p className="text-xs text-muted-foreground">
          {state.materials.length} factors defined
        </p>
      </div>
    </section>
  );
}
