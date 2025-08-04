
'use server';

import { getCurrentUser } from '@/lib/auth';
import type { MarketplaceListing } from '@/lib/types';
import { getListings as getListingsFromDB, getListingDetails as getListingDetailsFromDB, loadWorkspaceFromDB, runQuery } from './databaseActions';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

interface GetListingsResult {
    success: boolean;
    data?: MarketplaceListing[];
    error?: string;
}

export async function getListings(): Promise<GetListingsResult> {
    try {
        const result = await getListingsFromDB();
        if (result.error) {
            return { success: false, error: result.error };
        }
        return { success: true, data: result.data };
    } catch (error: any) {
        console.error('[MarketplaceActions] Erro ao buscar listagens:', error);
        return { success: false, error: `Erro de servidor: ${error.message}` };
    }
}

interface GetListingDetailsResult {
    success: boolean;
    data?: MarketplaceListing;
    error?: string;
}

export async function getListingDetails(listingId: string): Promise<GetListingDetailsResult> {
     if (!listingId) {
        return { success: false, error: "ID da listagem não fornecido." };
    }
    try {
        const result = await getListingDetailsFromDB(listingId);
        if (result.error) {
            return { success: false, error: result.error };
        }
        return { success: true, data: result.data };
    } catch (error: any) {
        console.error(`[MarketplaceActions] Erro ao buscar detalhes da listagem ${listingId}:`, error);
        return { success: false, error: `Erro de servidor: ${error.message}` };
    }
}


const ListWorkspaceSchema = z.object({
  workspaceId: z.string().uuid("ID do fluxo inválido."),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres.").max(500, "A descrição não pode exceder 500 caracteres."),
  tags: z.string().optional(),
});


export async function listWorkspaceForSaleAction(
    formData: FormData
): Promise<{ success: boolean; error?: string; issues?: z.ZodIssue[] }> {
    const user = await getCurrentUser();
    if (!user) {
        return { success: false, error: "Usuário não autenticado." };
    }

    const rawData = {
        workspaceId: formData.get('workspaceId') as string,
        description: formData.get('description') as string,
        tags: formData.get('tags') as string,
    };
    
    const validation = ListWorkspaceSchema.safeParse(rawData);
    if (!validation.success) {
        return { success: false, error: "Dados inválidos.", issues: validation.error.issues };
    }

    const { workspaceId, description, tags } = validation.data;
    
    try {
        const workspaceToList = await loadWorkspaceFromDB(workspaceId);
        if (!workspaceToList) {
            return { success: false, error: "Fluxo não encontrado." };
        }

        // Security check: ensure user owns the workspace
        if (workspaceToList.owner_id !== user.id) {
            return { success: false, error: "Você não tem permissão para vender este fluxo." };
        }

        const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [];

        const query = `
            INSERT INTO marketplace_listings (name, description, price, creator_id, workspace_id, preview_data, tags)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (workspace_id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                tags = EXCLUDED.tags,
                updated_at = NOW();
        `;
        
        await runQuery(query, [
            workspaceToList.name,
            description,
            0.00, // Preço inicial é sempre grátis
            user.id,
            workspaceId,
            JSON.stringify({ nodes: workspaceToList.nodes, connections: workspaceToList.connections }),
            tagsArray
        ]);
        
        revalidatePath('/marketplace');
        return { success: true };

    } catch (error: any) {
        console.error("[MarketplaceActions] Erro ao listar fluxo:", error);
        if (error.code === '23505' && error.constraint === 'marketplace_listings_workspace_id_key') {
            return { success: false, error: "Este fluxo já está listado no marketplace." };
        }
        return { success: false, error: `Erro de servidor: ${error.message}` };
    }
}

// export async function purchaseListingAction(listingId: string) { ... }
