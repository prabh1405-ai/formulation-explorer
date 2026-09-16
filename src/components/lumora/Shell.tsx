import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

export const STEPS = [
  "Materials",
  "Design",
  "Results",
  "Processing",
  "Models",
  "Graphs",
  "Optimize",
] as const;

export function Header() {
  return (
    <header className="border-b border-border/70 bg-card/40 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-5">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary glow">
          <FlaskConical className="size-5" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            LUMORA Formulation Optimizer
          </h1>
          <p className="text-xs text-muted-foreground">
            RSM-Based Bio-Composite Formulation Analysis
          </p>
        </div>
      </div>
    </header>
  );
}

export function Stepper({
  step,
  onSelect,
  maxUnlocked,
}: {
  step: number;
  onSelect: (i: number) => void;
  maxUnlocked: number;
}) {
  return (
    <nav className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-4">
      {STEPS.map((label, i) => {
        const locked = i > maxUnlocked;
        return (
          <button
            key={label}
            disabled={locked}
            onClick={() => onSelect(i)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              i === step
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
              locked && "opacity-40 hover:text-muted-foreground",
            )}
          >
            <span className="mono-num">{i + 1}</span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {right}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-panel/60 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mono-num mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
