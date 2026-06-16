import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Search, Download, TrendingUp, Play } from "lucide-react";

export const Route = createFileRoute("/app/historico")({
  head: () => ({
    meta: [
      { title: "Histórico · Andromeda" },
      { name: "description", content: "Todos os criativos com status, observações e exportação em lote." },
    ],
  }),
  component: Historico,
});

const statusStyle: Record<string, string> = {
  "Gerado": "bg-muted-foreground/20 text-muted-foreground border-muted-foreground/30",
  "Subiu": "bg-primary/20 text-primary-glow border-primary/40",
  "Rodando": "bg-accent/20 text-accent border-accent/40",
  "Performando": "bg-success/20 text-success border-success/40",
  "Pausado": "bg-destructive/20 text-destructive border-destructive/40",
};

const rows = [
  { d: "16/06", prod: "Suplemento X", ang: "Mecanismo único", fmt: "9:16", est: "Texto", status: "Performando" },
  { d: "15/06", prod: "Suplemento X", ang: "Prova social", fmt: "4:5", est: "Clipes", status: "Rodando" },
  { d: "15/06", prod: "Curso Y", ang: "Objeção invertida", fmt: "9:16", est: "Texto", status: "Subiu" },
  { d: "14/06", prod: "Suplemento X", ang: "Dor aguda", fmt: "9:16", est: "Clipes", status: "Pausado" },
  { d: "13/06", prod: "Curso Y", ang: "Antes/depois", fmt: "4:5", est: "Texto", status: "Performando" },
  { d: "12/06", prod: "App Z", ang: "Mecanismo único", fmt: "9:16", est: "Clipes", status: "Gerado" },
  { d: "11/06", prod: "App Z", ang: "Dor aguda", fmt: "9:16", est: "Texto", status: "Rodando" },
];

function Historico() {
  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold">Histórico</h1>
          <p className="text-muted-foreground mt-1">{rows.length} criativos · filtre, atualize status e exporte em lote.</p>
        </div>
        <Button variant="outline">
          <Download className="size-4 mr-1.5" /> Exportar pacote ZIP
        </Button>
      </div>

      <Card className="glass p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Buscar nas observações..." className="pl-9" />
          </div>
          <Select defaultValue="all"><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os produtos</SelectItem><SelectItem value="x">Suplemento X</SelectItem><SelectItem value="y">Curso Y</SelectItem></SelectContent>
          </Select>
          <Select defaultValue="all"><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os ângulos</SelectItem><SelectItem value="m">Mecanismo único</SelectItem><SelectItem value="p">Prova social</SelectItem></SelectContent>
          </Select>
          <Select defaultValue="all"><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="perf">Performando</SelectItem><SelectItem value="rod">Rodando</SelectItem></SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="glass overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="w-12"></TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Ângulo</TableHead>
              <TableHead>Formato</TableHead>
              <TableHead>Estilo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => (
              <TableRow key={i} className="border-border/30">
                <TableCell>
                  <div className="size-9 rounded bg-gradient-to-br from-primary/40 to-accent/30 flex items-center justify-center">
                    <Play className="size-3 text-primary-foreground fill-current" />
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{r.d}</TableCell>
                <TableCell className="font-medium">{r.prod}</TableCell>
                <TableCell>{r.ang}</TableCell>
                <TableCell className="text-muted-foreground">{r.fmt}</TableCell>
                <TableCell className="text-muted-foreground">{r.est}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusStyle[r.status]}>{r.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {r.status === "Performando" && (
                    <Link to="/app/escala">
                      <Button size="sm" className="bg-gradient-primary border-0">
                        <TrendingUp className="size-3.5 mr-1" /> Escalar
                      </Button>
                    </Link>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
