'use server';

import { getWorkspaceVersions, restoreWorkspaceVersion as restoreWorkspaceVersionDB } from './databaseActions';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import type { WorkspaceVersion, WorkspaceData } from '@/lib/types';

export async function getWorkspaceVersionsAction(workspaceId: string): Promise<{ data?: WorkspaceVersion[], error?: string }> {
    // Security check: ensure user has permission for this workspace
    // This is a simplified check. A real app would use RBAC.
    const user = await getCurrentUser();
    if (!user) {
        return { error: "Não autenticado." };
    }
    // More complex check would be needed here to see if user is in workspace's organization.
    
    return getWorkspaceVersions(workspaceId);
}

export async function restoreWorkspaceVersionAction(versionId: number): Promise<{ success: boolean; error?: string; workspace?: WorkspaceData }> {
    const user = await getCurrentUser();
    if (!user) {
        return { success: false, error: "Não autenticado." };
    }
    
    const result = await restoreWorkspaceVersionDB(versionId, user.id);
    
    if (result.success && result.workspace) {
        // Revalidate the flow page to force a reload with the new data
        revalidatePath(`/flow/${result.workspace.id}`);
    }
    
    return result;
}
