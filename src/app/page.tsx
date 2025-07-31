
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { loadWorkspacesForOwnerFromDB } from '@/app/actions/databaseActions';
import DashboardClient from '@/components/dashboard/DashboardClient';
import type { WorkspaceData } from '@/lib/types';

// Agora esta é uma página de servidor (Server Component)
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user || !user.id) {
    // Se não houver usuário, redireciona para o login no lado do servidor
    redirect('/login');
  }

  // Carrega os workspaces no servidor antes de renderizar a página
  const initialWorkspaces: WorkspaceData[] = await loadWorkspacesForOwnerFromDB(user.id);
  
  // Renderiza o componente de cliente, passando os dados pré-carregados
  return <DashboardClient user={user} initialWorkspaces={initialWorkspaces} />;
}
