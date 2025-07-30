import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ErrorBoundary from "@/components/ErrorBoundary";
import FlowBuilderClient from "@/components/flow-builder/FlowBuilderClient";

// This page now handles the rendering of the flow editor for a specific ID.
export default async function FlowEditorPage({ params }: { params: { workspaceId: string } }) {
  const user = await getCurrentUser();

  if (!user) {
    // Add a small delay before redirecting to give client-side session a chance to load
    await new Promise(resolve => setTimeout(resolve, 500));
    const userAfterDelay = await getCurrentUser(); // Check again after delay
    if (!userAfterDelay) {
      redirect('/login');
    }
  }

  const { workspaceId } = params;

  // We are now sure that the user is logged in at this point on the server (or after the delay check).
  // The FlowBuilderClient can be a client component and will receive the user info if needed.

  return (
    <ErrorBoundary>
        <FlowBuilderClient workspaceId={workspaceId} user={user} />
    </ErrorBoundary>
  );
}
