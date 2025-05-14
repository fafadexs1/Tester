
export interface DraggableBlockItemData {
  type: string;
  label: string;
  defaultData?: Partial<NodeData>;
}

export type NodeType = 
  | 'message' 
  | 'input' 
  | 'option' 
  | 'whatsapp-text' 
  | 'whatsapp-media' 
  | 'whatsapp-group' 
  | 'condition' 
  | 'set-variable' 
  | 'api-call' 
  | 'delay';

export interface NodeData {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  
  // Specific node type properties
  message?: string; // For 'message'
  instanceName?: string; // For 'whatsapp-*'
  phoneNumber?: string; // For 'whatsapp-text', 'whatsapp-media'
  textMessage?: string; // For 'whatsapp-text'
  mediaUrl?: string; // For 'whatsapp-media'
  mediaType?: 'image' | 'video' | 'document' | 'audio'; // For 'whatsapp-media'
  caption?: string; // For 'whatsapp-media'
  groupName?: string; // For 'whatsapp-group'
  participants?: string; // For 'whatsapp-group'
  conditionVariable?: string; // For 'condition'
  conditionOperator?: '==' | '!=' | '>' | '<' | 'contains' | 'startsWith' | 'endsWith'; // For 'condition'
  conditionValue?: string; // For 'condition'
  variableName?: string; // For 'set-variable'
  variableValue?: string; // For 'set-variable'
  apiUrl?: string; // For 'api-call'
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE'; // For 'api-call'
  apiHeaders?: string; // For 'api-call' (JSON string)
  apiBody?: string; // For 'api-call' (JSON string)
  delayDuration?: number; // For 'delay' (in ms)
}

export interface Connection {
  id: string;
  from: string; // Source node ID
  to: string;   // Target node ID
  sourceHandle?: string; // e.g., 'true', 'false' for condition, 'default' otherwise
}

export interface DrawingLineData {
  fromId: string;
  sourceHandleId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export interface CanvasOffset {
  x: number;
  y: number;
}
