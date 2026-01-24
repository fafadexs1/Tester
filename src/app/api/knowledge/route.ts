import { NextRequest, NextResponse } from 'next/server';
import { KnowledgeStore, KnowledgeWrite } from '@/lib/agent/memory/stores/knowledge-store';

/**
 * GET /api/knowledge - List knowledge entries
 * Query params: workspaceId (required), category (optional), limit, offset
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const workspaceId = searchParams.get('workspaceId');
        const category = searchParams.get('category') || undefined;
        const limit = parseInt(searchParams.get('limit') || '100', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        const connectionString = searchParams.get('connectionString');

        if (!workspaceId) {
            return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 });
        }

        if (!connectionString) {
            return NextResponse.json({
                error: 'connectionString is required. Configure it in the Memory Node.',
                success: false,
                entries: [],
                categories: [],
                count: 0
            }, { status: 400 });
        }

        const store = new KnowledgeStore(connectionString);
        const entries = await store.list({ workspaceId, category, limit, offset });
        const categories = await store.getCategories(workspaceId);

        return NextResponse.json({
            success: true,
            entries,
            categories,
            count: entries.length
        });
    } catch (error: any) {
        console.error('[Knowledge API] GET error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/knowledge - Create or update a knowledge entry
 * Body: { workspaceId, category, key, title, content, metadata?, connectionString?, embeddingsModel? }
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { workspaceId, category, key, title, content, metadata, connectionString, embeddingsModel } = body;

        if (!workspaceId || !category || !key || !title || !content) {
            return NextResponse.json({
                error: 'Missing required fields: workspaceId, category, key, title, content'
            }, { status: 400 });
        }

        if (!connectionString) {
            return NextResponse.json({
                error: 'connectionString is required. Configure it in the Memory Node.'
            }, { status: 400 });
        }

        const store = new KnowledgeStore(connectionString);
        const entry = await store.put({
            workspaceId,
            category,
            key,
            title,
            content,
            metadata
        }, embeddingsModel);

        return NextResponse.json({
            success: true,
            entry
        });
    } catch (error: any) {
        console.error('[Knowledge API] POST error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/knowledge - Delete a knowledge entry
 * Query params: id OR (workspaceId + category + key), connectionString (optional)
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');
        const workspaceId = searchParams.get('workspaceId');
        const category = searchParams.get('category');
        const key = searchParams.get('key');
        const connectionString = searchParams.get('connectionString');

        if (!connectionString) {
            return NextResponse.json({
                error: 'connectionString is required. Configure it in the Memory Node.'
            }, { status: 400 });
        }

        const store = new KnowledgeStore(connectionString);
        let deleted = false;

        if (id) {
            deleted = await store.delete(id);
        } else if (workspaceId && category && key) {
            deleted = await store.deleteByKey(workspaceId, category, key);
        } else {
            return NextResponse.json({
                error: 'Either id OR (workspaceId + category + key) is required'
            }, { status: 400 });
        }

        return NextResponse.json({
            success: deleted,
            message: deleted ? 'Entry deleted' : 'Entry not found'
        });
    } catch (error: any) {
        console.error('[Knowledge API] DELETE error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
