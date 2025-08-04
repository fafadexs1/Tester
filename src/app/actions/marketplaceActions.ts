
'use server';

import { getCurrentUser } from '@/lib/auth';
import type { MarketplaceListing } from '@/lib/types';
import { getListings as getListingsFromDB, getListingDetails as getListingDetailsFromDB } from './databaseActions';
import { revalidatePath } from 'next/cache';

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

// Em breve:
// export async function listWorkspaceForSaleAction(formData: FormData) { ... }
// export async function purchaseListingAction(listingId: string) { ... }
