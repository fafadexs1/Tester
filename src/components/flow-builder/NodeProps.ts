
import { NodeData, WorkspaceData } from '@/lib/types';

export interface NodeComponentProps {
    node: NodeData;
    onUpdate: (id: string, changes: Partial<NodeData>) => void;
    onStartConnection: (event: React.MouseEvent, fromNodeData: NodeData, sourceHandleId: string) => void;
    availableVariables: string[];
    activeWorkspace?: WorkspaceData | null;
    evolutionInstances?: any[]; // Replace with proper type if available
    isLoadingEvolutionInstances?: boolean;
    supabaseTables?: any[];
    isLoadingSupabaseTables?: boolean;
    supabaseSchemaError?: string | null;
    supabaseColumns?: any[];
    isLoadingSupabaseColumns?: boolean;
    activeNodeId?: string;
}
