import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Settings, Users, FolderKanban, Copy, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "@/contexts/workspace-context";
import { getWorkspaceSettings, updateOrganization, inviteOrganizationMember, listOrganizationInvites, cancelOrganizationInvite, updateMemberRole, removeOrganizationMember } from "@/lib/organizations.functions";
import { AppBreadcrumbs } from "@/components/app-breadcrumbs";

export const Route = createFileRoute("/app/configuracoes")({
  head: () => ({
    meta: [{ title: "Configurações · Andromeda" }],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { organizationId, currentOrg, loading: wsLoading } = useWorkspace();
  const queryClient = useQueryClient();
  const fetchSettings = useServerFn(getWorkspaceSettings);
  const runUpdateOrg = useServerFn(updateOrganization);
  const runInvite = useServerFn(inviteOrganizationMember);
  const fetchInvites = useServerFn(listOrganizationInvites);
  const runCancelInvite = useServerFn(cancelOrganizationInvite);
  const runUpdateRole = useServerFn(updateMemberRole);
  const runRemoveMember = useServerFn(removeOrganizationMember);

  const isOwner = currentOrg?.role === "owner";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["workspace-settings", organizationId],
    queryFn: () => fetchSettings({ data: { organizationId: organizationId! } }),
    enabled: !!organizationId && isOwner,
  });

  const { data: invitesData, refetch: refetchInvites } = useQuery({
    queryKey: ["workspace-invites", organizationId],
    queryFn: () => fetchInvites({ data: { organizationId: organizationId! } }),
    enabled: !!organizationId && isOwner,
  });

  const [orgName, setOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"editor" | "viewer">("editor");
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: (name: string) =>
      runUpdateOrg({ data: { organizationId: organizationId!, name } }),
    onSuccess: () => {
      toast.success("Workspace atualizado");
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar"),
  });

  const inviteMutation = useMutation({
    mutationFn: () =>
      runInvite({
        data: {
          organizationId: organizationId!,
          email: inviteEmail.trim(),
          role: inviteRole,
        },
      }),
    onSuccess: (res) => {
      toast.success("Convite criado");
      setInviteEmail("");
      setLastInviteLink(`${window.location.origin}${res.acceptPath}`);
      refetchInvites();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao convidar"),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: (inviteId: string) =>
      runCancelInvite({ data: { organizationId: organizationId!, inviteId } }),
    onSuccess: () => {
      toast.success("Convite cancelado");
      refetchInvites();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const roleMutation = useMutation({
    mutationFn: (payload: { memberUserId: string; role: "editor" | "viewer" }) =>
      runUpdateRole({ data: { organizationId: organizationId!, ...payload } }),
    onSuccess: () => {
      toast.success("Papel atualizado");
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const removeMutation = useMutation({
    mutationFn: (memberUserId: string) =>
      runRemoveMember({ data: { organizationId: organizationId!, memberUserId } }),
    onSuccess: () => {
      toast.success("Membro removido");
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  if (wsLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="size-8 animate-spin text-primary-glow" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="container mx-auto px-6 py-16 max-w-lg text-center space-y-4">
        <Settings className="size-10 mx-auto text-muted-foreground" />
        <h1 className="text-xl font-display font-bold">Configurações do workspace</h1>
        <p className="text-sm text-muted-foreground">
          Apenas o <strong>owner</strong> do workspace pode alterar configurações.
          Seu papel atual: <Badge variant="outline">{currentOrg?.role ?? "—"}</Badge>
        </p>
        <Link to="/app">
          <Button variant="outline">Voltar ao dashboard</Button>
        </Link>
      </div>
    );
  }

  const orgNameValue = orgName || data?.organization.name || "";

  return (
    <div className="container mx-auto px-6 py-8 max-w-3xl space-y-8">
      <AppBreadcrumbs items={[{ label: "Dashboard", to: "/app" }, { label: "Configurações" }]} />
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Settings className="size-6" /> Configurações
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Workspace <span className="text-foreground">{currentOrg?.name}</span>
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-8 animate-spin text-primary-glow" />
        </div>
      ) : isError ? (
        <Card className="glass p-6 text-destructive text-sm">
          {error instanceof Error ? error.message : "Erro ao carregar"}
        </Card>
      ) : (
        <Tabs defaultValue="geral">
          <TabsList>
            <TabsTrigger value="geral">Geral</TabsTrigger>
            <TabsTrigger value="membros">Membros</TabsTrigger>
          </TabsList>

          <TabsContent value="geral" className="mt-6 space-y-6">
            <Card className="glass p-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="org-name">Nome do workspace</Label>
                <Input
                  id="org-name"
                  value={orgNameValue}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Minha agência"
                />
                <p className="text-xs text-muted-foreground font-mono">slug: {data?.organization.slug}</p>
              </div>
              <Button
                disabled={updateMutation.isPending || !orgNameValue.trim()}
                onClick={() => updateMutation.mutate(orgNameValue.trim())}
              >
                {updateMutation.isPending && <Loader2 className="size-4 animate-spin mr-1.5" />}
                Salvar
              </Button>
            </Card>

            <Card className="glass p-6">
              <h2 className="font-semibold flex items-center gap-2 mb-3">
                <FolderKanban className="size-4" /> Projetos
              </h2>
              <p className="text-sm text-muted-foreground mb-4">
                Gerencie clientes e projetos do workspace.
              </p>
              <Link to="/app/projetos">
                <Button variant="outline">Abrir projetos</Button>
              </Link>
            </Card>
          </TabsContent>

          <TabsContent value="membros" className="mt-6 space-y-6">
            <Card className="glass p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="size-4" /> Convidar membro
              </h2>
              <div className="flex flex-wrap gap-2">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 min-w-[200px]"
                />
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as "editor" | "viewer")}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  disabled={inviteMutation.isPending || !inviteEmail.trim()}
                  onClick={() => inviteMutation.mutate()}
                >
                  {inviteMutation.isPending && <Loader2 className="size-4 animate-spin mr-1" />}
                  Enviar convite
                </Button>
              </div>
              {lastInviteLink && (
                <div className="flex items-center gap-2 text-xs bg-muted/30 p-2 rounded">
                  <span className="truncate flex-1 font-mono">{lastInviteLink}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(lastInviteLink);
                      toast.success("Link copiado");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                </div>
              )}
            </Card>

            {(invitesData?.invites.length ?? 0) > 0 && (
              <Card className="glass p-6 space-y-3">
                <h3 className="font-medium text-sm">Convites pendentes</h3>
                {invitesData?.invites.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/30 pb-2 last:border-0">
                    <div>
                      <p>{inv.email}</p>
                      <p className="text-[10px] text-muted-foreground">{inv.role}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => cancelInviteMutation.mutate(inv.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </Card>
            )}

            <Card className="glass p-6 space-y-4">
              <h2 className="font-semibold flex items-center gap-2">
                <Users className="size-4" /> Membros ({data?.members.length ?? 0})
              </h2>
              <div className="space-y-3">
                {data?.members.map((m) => (
                  <div
                    key={m.userId}
                    className="flex items-center justify-between gap-2 py-2 border-b border-border/30 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{m.displayName ?? "Sem nome"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                        {m.userId}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {m.role === "owner" ? (
                        <Badge variant="default">{m.role}</Badge>
                      ) : (
                        <>
                          <Select
                            value={m.role}
                            onValueChange={(role) =>
                              roleMutation.mutate({
                                memberUserId: m.userId,
                                role: role as "editor" | "viewer",
                              })
                            }
                          >
                            <SelectTrigger className="w-[100px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="editor">editor</SelectItem>
                              <SelectItem value="viewer">viewer</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => removeMutation.mutate(m.userId)}
                          >
                            <UserMinus className="size-4 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
