
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadWorkspaceFromDB } from "@/app/actions/databaseActions";
import ErrorBoundary from "@/components/ErrorBoundary";
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";

export default async function FlowEditorPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();

  if (!user || !user.id) {
    redirect('/login');
  }

  const { workspaceId } = params;

  // A criação de 'new' agora é tratada no dashboard, então se chegarmos aqui com 'new', redirecionamos.
  if (workspaceId === 'new') {
    console.warn(`[FlowEditorPage] Rota /flow/new acessada diretamente. Redirecionando para o dashboard...`);
    redirect('/');
  }

  // Carrega os dados do workspace no servidor para um carregamento inicial mais rápido
  const initialWorkspace = await loadWorkspaceFromDB(workspaceId);
  
  if (!initialWorkspace) {
    console.warn(`[FlowEditorPage] Workspace com ID ${workspaceId} não encontrado. Redirecionando...`);
    redirect('/');
  }
  
  // Verifica se o usuário logado é o dono do workspace
  if (initialWorkspace.owner !== user.id) {
      console.warn(`[FlowEditorPage] Usuário ${user.username} (ID: ${user.id}) tentou acessar o workspace ${workspaceId} que pertence ao owner ID ${initialWorkspace.owner}. Acesso negado.`);
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
