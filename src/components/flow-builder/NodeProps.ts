
import { NodeData, OrganizationAiKeySummary, WorkspaceData } from '@/lib/types';

export interface NodeComponentProps {
    node: NodeData;
    onUpdate: (id: string, changes: Partial<NodeData>) => void;
    /** @deprecated React Flow owns connection gestures through Handle components. */
    onStartConnection?: (event: React.MouseEvent, fromNodeData: NodeData, sourceHandleId: string) => void;
    availableVariables: string[];
    activeWorkspace?: WorkspaceData | null;
    organizationGeminiKeys?: OrganizationAiKeySummary[];
    evolutionInstances?: any[]; // Replace with proper type if available
    isLoadingEvolutionInstances?: boolean;
    supabaseTables?: any[];
    isLoadingSupabaseTables?: boolean;
    supabaseSchemaError?: string | null;
    supabaseColumns?: any[];
    isLoadingSupabaseColumns?: boolean;
    activeNodeId?: string;
    /** Set false when the editor body is rendered outside a ReactFlow provider (for example, a config dialog). */
    renderHandles?: boolean;
    /** @deprecated React Flow owns target handles and connection completion. */
    onEndConnection?: (event: React.MouseEvent, node: NodeData, handleId?: string) => void;
}
