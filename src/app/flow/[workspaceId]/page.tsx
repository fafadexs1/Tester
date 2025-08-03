
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadWorkspaceFromDB } from "@/app/actions/databaseActions";
import ErrorBoundary from "@/components/ErrorBoundary";
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";

// O flow editor não usará o AppShell, então o layout aqui é diferente
export default async function FlowEditorPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();

  if (!user || !user.id) {
    redirect('/login');
  }

  const { workspaceId } = await params;

  if (workspaceId === 'new') {
    console.warn(`[FlowEditorPage] Rota /flow/new acessada diretamente. Redirecionando para o dashboard...`);
    redirect('/');
  }

  const initialWorkspace = await loadWorkspaceFromDB(workspaceId);
  
  if (!initialWorkspace) {
    console.warn(`[FlowEditorPage] Workspace com ID ${workspaceId} não encontrado. Redirecionando...`);
    redirect('/');
  }
  
  const organizationId = initialWorkspace.organization_id;
  const userOrgs = await loadOrganizationsForUser(user.id);

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

// Helper function to get user organizations
import { getOrganizationsForUser as loadOrganizationsForUser } from '@/app/actions/databaseActions';
