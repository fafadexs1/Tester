
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { loadAllActiveSessionsFromDB, deleteSessionFromDB, deleteAllSessionsForOwnerFromDB } from '@/app/actions/databaseActions';
import type { FlowSession, User } from '@/lib/types';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  console.log('[API /sessions/active] GET request received');
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const activeSessions: FlowSession[] = await loadAllActiveSessionsFromDB(user.id);

    // Filter by workspaceId if provided
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId');

    const filteredSessions = workspaceId
      ? activeSessions.filter(s => s.workspace_id === workspaceId)
      : activeSessions;

    // console.log(`[API /sessions/active] Returning ${filteredSessions.length} active sessions for user ${user.username}.`);
    return NextResponse.json(filteredSessions, { status: 200 });
  } catch (error: any) {
    console.error('[API /sessions/active] Error fetching active sessions:', error);
    return NextResponse.json({ error: 'Failed to fetch active sessions', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  console.log('[API /sessions/active] DELETE request received');
  const user = await getCurrentUser();
  if (!user || !user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  // Handle deleting all sessions for the user
  if (!sessionId) {
    console.log(`[API /sessions/active] User ${user.username} attempting to delete ALL sessions.`);
    try {
      // Filter by workspace if provided
      const workspaceId = searchParams.get('workspaceId');

      const result = await deleteAllSessionsForOwnerFromDB(user.id, workspaceId || undefined);
      if (result.success) {
        return NextResponse.json({ message: `${result.count} sessions deleted successfully` }, { status: 200 });
      } else {
        throw new Error(result.error || 'Failed to delete all sessions');
      }
    } catch (error: any) {
      console.error(`[API /sessions/active] Error deleting all sessions for user ${user.id}:`, error);
      return NextResponse.json({ error: 'Failed to delete all sessions', details: error.message }, { status: 500 });
    }
  }

  // Handle deleting a single session
  console.log(`[API /sessions/active] User ${user.username} attempting to delete session with ID: ${sessionId}`);
  try {
    // TODO: For enhanced security, verify the user owns the workspace associated with the session before deleting.
    // This would require loading the session, getting the workspace_id, loading the workspace, and checking the owner.
    // For now, we assume any logged-in user can delete any session if they have the ID.
    // This is safe as long as only admins/devs can see all sessions. If regular users can see sessions, this needs a check.

    const result = await deleteSessionFromDB(sessionId);
    if (result.success) {
      return NextResponse.json({ message: `Session ${sessionId} deleted successfully` }, { status: 200 });
    } else {
      // The row might not have been found, which is a success from the user's perspective.
      return NextResponse.json({ message: `Session ${sessionId} deletion processed.` }, { status: 200 });
    }
  } catch (error: any) {
    console.error(`[API /sessions/active] Error deleting session ${sessionId}:`, error);
    return NextResponse.json({ error: 'Failed to delete session', details: error.message }, { status: 500 });
  }
}
