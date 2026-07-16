import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { loadWorkspacesForOrganizationFromDB } from '@/app/actions/databaseActions';
import DashboardClient from '@/components/dashboard/DashboardClient';
import type { WorkspaceData } from '@/lib/types';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect('/presentation');
  }

  if (!user.current_organization_id) {
    console.warn(`Usuário ${user.username} sem organização atual. Redirecionando para o perfil.`);
    redirect('/profile');
  }

  const initialWorkspaces: WorkspaceData[] = await loadWorkspacesForOrganizationFromDB(
    user.current_organization_id,
  );

  return <DashboardClient user={user} initialWorkspaces={initialWorkspaces} />;
}
