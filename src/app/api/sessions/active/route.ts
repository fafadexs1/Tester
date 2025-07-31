
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loadAllActiveSessionsFromDB, deleteSessionFromDB } from '@/app/actions/databaseActions';
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

export async function DELETE(request: NextRequest) {
  console.log('[API /sessions/active] DELETE request received');
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  if (!sessionId) {
    return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
  }
  
  console.log(`[API /sessions/active] Attempting to delete session with ID: ${sessionId}`);
  try {
    const result = await deleteSessionFromDB(sessionId);
    if (result.success) {
      return NextResponse.json({ message: `Session ${sessionId} deleted successfully` }, { status: 200 });
    } else {
      return NextResponse.json({ error: `Failed to delete session ${sessionId}`, details: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error(`[API /sessions/active] Error deleting session ${sessionId}:`, error);
    return NextResponse.json({ error: 'Failed to delete session', details: error.message }, { status: 500 });
  }
}
