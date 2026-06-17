import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject } from "@/lib/organizations.functions";
import { useWorkspace } from "@/contexts/workspace-context";
import { toast } from "sonner";
import { FolderKanban, Plus } from "lucide-react";

export const Route = createFileRoute("/app/projetos")({
  head: () => ({
    meta: [{ title: "Projetos · Andromeda" }],
  }),
  component: Projetos,
});

function Projetos() {
  const { organizations, organizationId, refresh, currentOrg } = useWorkspace();
  const runCreate = useServerFn(createProject);
  const [name, setName] = useState("");
  const [nicho, setNicho] = useState("");
  const [loading, setLoading] = useState(false);

  const org = currentOrg ?? organizations.find((o) => o.id === organizationId);

  async function handleCreate() {
    if (!organizationId || !name.trim()) {
      toast.error("Informe o nome do projeto");
      return;
    }
    setLoading(true);
    try {
      await runCreate({
        data: { organizationId, name: name.trim(), nicho: nicho || undefined },
      });
      toast.success("Projeto criado");
      setName("");
      setNicho("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao criar projeto");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold flex items-center gap-3">
          <FolderKanban className="size-7 text-primary-glow" /> Projetos
        </h1>
        <p className="text-muted-foreground mt-1">
          Workspace: <span className="text-foreground">{org?.name}</span> — separe clientes ou produtos.
        </p>
      </div>

      <Card className="glass p-6 space-y-4">
        <h2 className="font-semibold">Novo projeto</h2>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label>Nome do projeto / cliente</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Suplemento X" />
          </div>
          <div className="space-y-1.5">
            <Label>Nicho (opcional)</Label>
            <Input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="Ex: Saúde e bem-estar" />
          </div>
          <Button onClick={handleCreate} disabled={loading} className="bg-gradient-primary border-0 w-fit">
            <Plus className="size-4 mr-1.5" /> Criar projeto
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        <h2 className="font-semibold">Projetos ativos</h2>
        {org?.projects.map((p) => (
          <Card key={p.id} className="glass p-4 flex justify-between items-center">
            <div>
              <div className="font-medium">{p.name}</div>
              {p.nicho && <div className="text-sm text-muted-foreground">{p.nicho}</div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
