
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadWorkspaceFromDB, getOrganizationsForUser } from "@/app/actions/databaseActions";
import ErrorBoundary from "@/components/ErrorBoundary";
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";

interface FlowEditorPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

// O flow editor não usará o AppShell, então o layout aqui é diferente
export default async function FlowEditorPage({ params }: FlowEditorPageProps) {
  const user = await getCurrentUser();
  const { workspaceId } = await params;

  if (!user || !user.id) {
    redirect('/login');
  }

  if (!workspaceId || workspaceId === 'new' || workspaceId === 'undefined') {
    console.warn(`[FlowEditorPage] ID de workspace inválido ('${workspaceId}'). Redirecionando para o dashboard...`);
    redirect('/');
  }

  const initialWorkspace = await loadWorkspaceFromDB(workspaceId);

  if (!initialWorkspace) {
    console.warn(`[FlowEditorPage] Workspace com ID ${workspaceId} não encontrado. Redirecionando...`);
    redirect('/');
  }

  const organizationId = initialWorkspace.organization_id;
  const userOrgs = await getOrganizationsForUser(user.id);

  const isUserInOrg = userOrgs.some(org => org.id === organizationId);

  if (!isUserInOrg && user.role !== 'desenvolvedor') {
    console.warn(`[FlowEditorPage] User ${user.username} (ID: ${user.id}) tried to access workspace ${workspaceId} from org ${organizationId} but is not a member. Access denied.`);
    redirect('/');
  }

  return (
    <ErrorBoundary>
      <FlowBuilderClient
        workspaceId={workspaceId}
        user={user}
        initialWorkspace={initialWorkspace}
      />
    </ErrorBoundary>
  );
}
