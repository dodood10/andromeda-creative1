import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { listAdminAuditLog } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/auditoria")({
  head: () => ({ meta: [{ title: "Admin · Auditoria" }] }),
  component: AdminAuditoria,
});

function AdminAuditoria() {
  const [days, setDays] = useState("30");
  const fetchLog = useServerFn(listAdminAuditLog);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit", days],
    queryFn: () =>
      fetchLog({
        data: { limit: 100, days: days === "all" ? undefined : Number(days) },
      }),
  });

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold">Auditoria</h1>
          <p className="text-sm text-muted-foreground mt-1">Ações registradas no painel admin</p>
        </div>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 dias</SelectItem>
            <SelectItem value="30">30 dias</SelectItem>
            <SelectItem value="90">90 dias</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      ) : (
        <div className="glass rounded-xl border border-border/40 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Ator</TableHead>
                <TableHead>Alvo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(e.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.action}</TableCell>
                  <TableCell className="font-mono text-[10px] max-w-[120px] truncate">{e.actor_user_id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.target_type ? `${e.target_type}` : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
