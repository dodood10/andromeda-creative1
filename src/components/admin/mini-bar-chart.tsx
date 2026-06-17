type Point = { label: string; value: number };

export function MiniBarChart({ data, color = "bg-primary/60" }: { data: Point[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  }
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className={`w-full rounded-t ${color} transition-all`}
            style={{ height: `${Math.max(4, (d.value / max) * 100)}%` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="text-[9px] text-muted-foreground truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
