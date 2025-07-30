import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadWorkspaceFromDB } from "@/app/actions/databaseActions";
import ErrorBoundary from "@/components/ErrorBoundary";
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";

// This page now handles the rendering of the flow editor for a specific ID.
export default async function FlowEditorPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    // Se o usuário não for encontrado no servidor, redireciona para o login
    redirect('/login');
  }

  const { workspaceId } = params;

  // Carrega os dados do workspace no servidor para um carregamento inicial mais rápido
  const initialWorkspace = workspaceId !== 'new' ? await loadWorkspaceFromDB(workspaceId) : null;
  
  if (workspaceId !== 'new' && !initialWorkspace) {
    // Se um ID foi fornecido mas o workspace não foi encontrado, redireciona para o dashboard
    console.warn(`[FlowEditorPage] Workspace com ID ${workspaceId} não encontrado. Redirecionando...`);
    redirect('/');
  }

  // We are now sure that the user is logged in at this point on the server.
  // The FlowBuilderClient can be a client component and will receive the user info if needed.

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
