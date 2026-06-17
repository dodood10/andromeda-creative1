import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Search } from "lucide-react";
import { listAdminOrganizations } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/organizacoes")({
  head: () => ({ meta: [{ title: "Admin · Organizações" }] }),
  component: AdminOrganizacoes,
});

function AdminOrganizacoes() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const fetchOrgs = useServerFn(listAdminOrganizations);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orgs", query],
    queryFn: () => fetchOrgs({ data: { search: query || undefined } }),
  });

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Organizações</h1>
        <p className="text-sm text-muted-foreground mt-1">Workspaces e clientes das agências</p>
      </div>

      <form
        className="flex gap-2 max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(search);
        }}
      >
        <Input placeholder="Buscar workspace..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <Button type="submit" variant="outline" size="icon">
          <Search className="size-4" />
        </Button>
      </form>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      ) : (
        <div className="space-y-4">
          {data?.organizations.map((org) => (
            <Card key={org.id} className="glass p-5 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="font-semibold">{org.name}</h2>
                  <p className="text-xs text-muted-foreground font-mono">{org.slug}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="outline">{org.memberCount} membros</Badge>
                  <Badge variant="outline">{org.criativoCount} criativos</Badge>
                  {org.performando > 0 && (
                    <Badge className="bg-success/20 text-success border-success/40">
                      {org.performando} performando
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-xs text-muted-foreground">
                  Criado em {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/admin/criativos" search={{ organizationId: org.id }}>
                    Ver criativos
                  </Link>
                </Button>
              </div>
              {org.projects.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {org.projects.map((p) => (
                    <Badge key={p.id} variant="secondary" className="text-xs">
                      {p.name}
                      {p.nicho ? ` · ${p.nicho}` : ""}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
          {(data?.organizations.length ?? 0) === 0 && (
            <p className="text-center text-muted-foreground py-12">Nenhuma organização encontrada.</p>
          )}
        </div>
      )}
    </div>
  );
}
