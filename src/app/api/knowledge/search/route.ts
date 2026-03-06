import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeStore } from '@/lib/agent/memory/stores/knowledge-store';
import { DEFAULT_EMBEDDINGS_MODEL } from '@/lib/agent/memory/models';

/**
 * POST /api/knowledge/search - Search knowledge base
 * Body: { workspaceId, query, category?, limit?, connectionString?, embeddingsModel? }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { workspaceId, query, category, limit, connectionString, embeddingsModel } = body;

        if (!workspaceId || !query) {
            return NextResponse.json({
                error: 'workspaceId and query are required'
            }, { status: 400 });
        }

        const store = new KnowledgeStore(connectionString);
        const results = await store.search({
            workspaceId,
            query,
            category,
            limit: limit || 5,
            embeddingsModel: embeddingsModel || DEFAULT_EMBEDDINGS_MODEL
        });

        return NextResponse.json({
            success: true,
            found: results.length > 0,
            count: results.length,
            results
        });
    } catch (error: any) {
        console.error('[Knowledge Search API] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
