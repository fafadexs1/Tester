import { WorkspaceData, NodeData, Connection } from "@/lib/types";

export interface ExportedFlowData {
    version: string;
    name: string;
    nodes: NodeData[];
    connections: Connection[];
    settings: {
        evolution_instance_id?: string | null;
        chatwoot_enabled?: boolean;
        chatwoot_instance_id?: string | null;
        dialogy_instance_id?: string | null;
    };
}

export const exportFlow = (workspace: WorkspaceData) => {
    const flowData: ExportedFlowData = {
        version: "1.0",
        name: workspace.name,
        nodes: workspace.nodes,
        connections: workspace.connections,
        settings: {
            evolution_instance_id: workspace.evolution_instance_id,
            chatwoot_enabled: workspace.chatwoot_enabled,
            chatwoot_instance_id: workspace.chatwoot_instance_id,
            dialogy_instance_id: workspace.dialogy_instance_id,
        },
    };

    const jsonString = JSON.stringify(flowData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `flow-${workspace.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const importFlow = (
    file: File,
    onUpdate: (data: Partial<WorkspaceData>) => void
): Promise<void> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const jsonString = e.target?.result as string;
                const importedData = JSON.parse(jsonString) as ExportedFlowData;

                // Basic validation
                if (!importedData.nodes || !Array.isArray(importedData.nodes)) {
                    throw new Error("Invalid flow file: 'nodes' missing or invalid.");
                }
                if (!importedData.connections || !Array.isArray(importedData.connections)) {
                    throw new Error("Invalid flow file: 'connections' missing or invalid.");
                }

                // Construct update object
                const updates: Partial<WorkspaceData> = {
                    nodes: importedData.nodes,
                    connections: importedData.connections,
                    // Merge settings if they exist in the imported file
                    ...(importedData.settings?.evolution_instance_id !== undefined && { evolution_instance_id: importedData.settings.evolution_instance_id }),
                    ...(importedData.settings?.chatwoot_enabled !== undefined && { chatwoot_enabled: importedData.settings.chatwoot_enabled }),
                    ...(importedData.settings?.chatwoot_instance_id !== undefined && { chatwoot_instance_id: importedData.settings.chatwoot_instance_id }),
                    ...(importedData.settings?.dialogy_instance_id !== undefined && { dialogy_instance_id: importedData.settings.dialogy_instance_id }),
                };

                onUpdate(updates);
                resolve();
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error("Failed to read file."));
        };

        reader.readAsText(file);
    });
};
