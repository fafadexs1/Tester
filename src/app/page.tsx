
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadWorkspacesForOrganizationFromDB } from '@/app/actions/databaseActions';
import DashboardClient from '@/components/dashboard/DashboardClient';
import type { WorkspaceData } from '@/lib/types';
import AppShell from "@/components/AppShell";

// Agora esta é uma página de servidor (Server Component)
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user || !user.id) {
    // Se não houver usuário, redireciona para o login no lado do servidor
    redirect('/login');
  }

  // Se o usuário não tiver uma organização selecionada, talvez redirecionar para uma página de seleção de organização
  if (!user.current_organization_id) {
    // Por enquanto, redirecionamos para uma página de erro/aviso ou perfil
    // Em uma implementação futura, seria uma página de seleção de organização.
    console.warn(`Usuário ${user.username} sem organização atual. Redirecionando para o perfil.`);
    redirect('/profile'); 
  }

  // Carrega os workspaces da organização ativa do usuário
  const initialWorkspaces: WorkspaceData[] = await loadWorkspacesForOrganizationFromDB(user.current_organization_id);
  
  // Renderiza o componente de cliente, passando os dados pré-carregados DENTRO do AppShell
  return (
    <AppShell>
        <DashboardClient user={user} initialWorkspaces={initialWorkspaces} />
    </AppShell>
  );
}
