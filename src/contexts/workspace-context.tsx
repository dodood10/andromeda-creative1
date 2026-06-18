import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import { listWorkspaces, type WorkspaceOrg } from "@/lib/organizations.functions";

const STORAGE_KEY = "andromeda_workspace";

type WorkspaceState = {
  organizationId: string;
  projectId: string;
};

type WorkspaceContextValue = {
  organizations: WorkspaceOrg[];
  organizationId: string | null;
  projectId: string | null;
  currentOrg: WorkspaceOrg | null;
  currentProject: WorkspaceOrg["projects"][0] | null;
  loading: boolean;
  setWorkspace: (organizationId: string, projectId: string) => void;
  refresh: () => Promise<{ organizationId: string | null; projectId: string | null }>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function loadStored(): WorkspaceState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WorkspaceState) : null;
  } catch {
    return null;
  }
}

function saveStored(state: WorkspaceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const fetchWorkspaces = useServerFn(listWorkspaces);
  const [organizations, setOrganizations] = useState<WorkspaceOrg[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { organizations: orgs } = await fetchWorkspaces();
    setOrganizations(orgs);

    const stored = loadStored();
    const firstOrg = orgs[0];
    const firstProject = firstOrg?.projects[0];

    const orgId =
      stored && orgs.some((o) => o.id === stored.organizationId)
        ? stored.organizationId
        : firstOrg?.id ?? null;

    const org = orgs.find((o) => o.id === orgId);
    const projId =
      stored && org?.projects.some((p) => p.id === stored.projectId)
        ? stored.projectId
        : org?.projects[0]?.id ?? firstProject?.id ?? null;

    setOrganizationId(orgId);
    setProjectId(projId);
    if (orgId && projId) saveStored({ organizationId: orgId, projectId: projId });
    return { organizationId: orgId, projectId: projId };
  }, [fetchWorkspaces]);

  useEffect(() => {
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [refresh]);

  const setWorkspace = useCallback((orgId: string, projId: string) => {
    setOrganizationId(orgId);
    setProjectId(projId);
    saveStored({ organizationId: orgId, projectId: projId });
  }, []);

  const currentOrg = useMemo(
    () => organizations.find((o) => o.id === organizationId) ?? null,
    [organizations, organizationId],
  );

  const currentProject = useMemo(
    () => currentOrg?.projects.find((p) => p.id === projectId) ?? null,
    [currentOrg, projectId],
  );

  const value: WorkspaceContextValue = {
    organizations,
    organizationId,
    projectId,
    currentOrg,
    currentProject,
    loading,
    setWorkspace,
    refresh,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
