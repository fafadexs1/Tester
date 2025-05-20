
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loadAllActiveSessionsFromDB } from '@/app/actions/databaseActions';
import type { FlowSession } from '@/lib/types';

export async function GET(request: NextRequest) {
  console.log('[API /sessions/active] GET request received');
  try {
    const activeSessions: FlowSession[] = await loadAllActiveSessionsFromDB();
    // console.log(`[API /sessions/active] Returning ${activeSessions.length} active sessions. Data:`, JSON.stringify(activeSessions, null, 2));
    return NextResponse.json(activeSessions, { status: 200 });
  } catch (error: any) {
    console.error('[API /sessions/active] Error fetching active sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch active sessions', details: error.message }, { status: 500 });
  }
}
