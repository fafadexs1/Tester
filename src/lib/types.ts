

export interface DraggableBlockItemData {
  type: string;
  label: string;
  defaultData?: Partial<NodeData>;
}

export type NodeType = 
  | 'start' 
  | 'message' 
  | 'input' 
  | 'option' 
  | 'whatsapp-text' 
  | 'whatsapp-media' 
  | 'whatsapp-group'
  | 'condition' 
  | 'switch'
  | 'set-variable' 
  | 'api-call' 
  | 'delay'
  | 'date-input'
  | 'redirect'
  | 'typing-emulation'
  | 'media-display'
  | 'log-console'
  | 'code-execution'
  | 'json-transform'
  | 'file-upload'
  | 'rating-input'
  | 'ai-text-generation'
  | 'send-email'
  | 'google-sheets-append'
  | 'intelligent-agent'
  | 'supabase-create-row'
  | 'supabase-read-row'
  | 'supabase-update-row'
  | 'supabase-delete-row'
  | 'end-flow';
  

export interface ApiHeader {
  id: string;
  key: string;
  value: string;
}

export interface ApiQueryParam {
  id: string;
  key: string;
  value: string;
}

export interface ApiFormDataEntry {
  id: string;
  key: string;
  value: string;
}

export interface WebhookVariableMapping {
  id: string;
  jsonPath: string;
  flowVariable: string;
}

export interface StartNodeTrigger {
  id: string;
  name: string; 
  type: 'manual' | 'webhook';
  enabled: boolean;
  keyword?: string; // Palavra-chave para roteamento
  variableMappings?: WebhookVariableMapping[];
  sessionTimeoutSeconds?: number;
}

export interface SwitchCase {
  id: string;
  value: string;
}

export interface NodeData {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  dataAiHint?: string; 
  
  // Message Node
  text?: string; 
  
  // Input Node
  promptText?: string; 
  inputType?: 'text' | 'email' | 'phone' | 'number'; 
  variableToSaveResponse?: string;
  apiResponseAsInput?: boolean;
  apiResponsePathForValue?: string;

  // Option Node
  questionText?: string;
  optionsList?: string; 
  variableToSaveChoice?: string;

  // WhatsApp Nodes (can also be triggered by api-call node)
  instanceName?: string; 
  phoneNumber?: string; 
  textMessage?: string; 
  mediaUrl?: string; 
  mediaType?: 'image' | 'video' | 'document' | 'audio'; 
  caption?: string; 
  groupName?: string; 
  participants?: string; 
  
  // Condition Node
  conditionVariable?: string; 
  conditionOperator?: '==' | '!=' | '>' | '<' | '>=' | '<=' | 'contains' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty' | 'isTrue' | 'isFalse' | 'isDateAfter' | 'isDateBefore'; 
  conditionValue?: string;
  conditionDataType?: 'string' | 'number' | 'boolean' | 'date';
  
  // Switch Node
  switchVariable?: string;
  switchCases?: SwitchCase[];

  // Set Variable Node
  variableName?: string; 
  variableValue?: string; 
  
  // API Call Node
  apiUrl?: string; 
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; 
  apiAuthType?: 'none' | 'bearer' | 'basic';
  apiAuthBearerToken?: string;
  apiAuthBasicUser?: string;
  apiAuthBasicPassword?: string;
  apiHeadersList?: ApiHeader[];
  apiQueryParamsList?: ApiQueryParam[];
  apiBodyType?: 'none' | 'json' | 'form-data' | 'raw';
  apiBodyJson?: string; 
  apiBodyFormDataList?: ApiFormDataEntry[]; 
  apiBodyRaw?: string; 
  apiOutputVariable?: string;
  apiResponsePath?: string;
  
  // Delay Node
  delayDuration?: number; 

  // Date Input Node
  dateInputLabel?: string;
  variableToSaveDate?: string;

  // Redirect Node
  redirectUrl?: string;

  // Typing Emulation Node
  typingDuration?: number; 

  // Media Display Node
  mediaDisplayType?: 'image' | 'video' | 'audio';
  mediaDisplayUrl?: string;
  mediaDisplayText?: string; 

  // Log Console Node
  logMessage?: string;

  // Code Execution Node
  codeSnippet?: string;
  codeOutputVariable?: string;

  // JSON Transform Node
  inputJson?: string; 
  jsonataExpression?: string;
  jsonOutputVariable?: string;

  // File Upload Node
  uploadPromptText?: string;
  fileTypeFilter?: string; // e.g., "image/*,.pdf"
  maxFileSizeMB?: number;
  fileUrlVariable?: string;

  // Rating Input Node
  ratingQuestionText?: string;
  maxRatingValue?: number;
  ratingIconType?: 'star' | 'heart' | 'number';
  ratingOutputVariable?: string;

  // AI Text Generation Node
  aiPromptText?: string;
  aiModelName?: string; 
  aiOutputVariable?: string;
  
  // Send Email Node
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailFrom?: string; 

  // Google Sheets Append Node
  googleSheetId?: string;
  googleSheetName?: string; 
  googleSheetRowData?: string; // JSON string of an array

  // Intelligent Agent Node
  agentName?: string;
  agentSystemPrompt?: string;
  userInputVariable?: string; 
  agentResponseVariable?: string; 
  maxConversationTurns?: number; 
  temperature?: number; 

  // Supabase Nodes
  supabaseTableName?: string;
  supabaseIdentifierColumn?: string; 
  supabaseIdentifierValue?: string; 
  supabaseDataJson?: string; 
  supabaseColumnsToSelect?: string; 
  supabaseResultVariable?: string; 
  
  // Start Node
  triggers?: StartNodeTrigger[];

}

export interface Connection {
  id: string;
  from: string; 
  to: string;   
  sourceHandle?: string; 
}

export interface DrawingLineData {
  fromId: string;
  sourceHandleId: string; 
  startX: number; // Logical X
  startY: number; // Logical Y
  currentX: number; // Logical X of mouse
  currentY: number; // Logical Y of mouse
}

export interface CanvasOffset {
  x: number;
  y: number;
}

export interface WorkspaceData {
  id: string;
  name: string;
  nodes: NodeData[];
  connections: Connection[];
  owner_id: string; 
  organization_id: string; 
  created_at?: string | Date;
  updated_at?: string | Date;
  evolution_instance_id?: string | null;
  chatwoot_enabled?: boolean;
  chatwoot_instance_id?: string | null;
}

export type AwaitingInputNode = 'input' | 'option' | 'date-input' | 'file-upload' | 'rating-input';
export type FlowSessionAwaitingInputType = AwaitingInputNode | null;
export type FlowContextType = 'evolution' | 'chatwoot' | 'test';

export interface FlowSession {
  session_id: string; 
  workspace_id: string;
  current_node_id: string | null;
  flow_variables: Record<string, any>;
  awaiting_input_type: FlowSessionAwaitingInputType;
  awaiting_input_details: {
    variableToSave?: string; 
    options?: string[];       
    originalNodeId?: string; 
  } | null;
  session_timeout_seconds?: number;
  last_interaction_at?: string | Date;
  created_at?: string | Date;
  flow_context?: FlowContextType;
}

export type UserRole = 'admin' | 'desenvolvedor' | 'Editor de Fluxo' | 'Publicador' | 'Visualizador' | 'user';

export interface User {
    id: string; // UUID
    username: string;
    fullName?: string;
    email?: string;
    role: UserRole;
    password_hash?: string;
    current_organization_id?: string;
}

export interface Organization {
  id: string; // UUID
  name: string;
  owner_id: string; // ID do usuário que criou a organização
  created_at?: string | Date;
}

export interface Team {
    id: string;
    name: string;
    description?: string;
    organization_id: string;
    members: Pick<User, 'id' | 'username'>[];
}

export interface OrganizationUser {
  id: string; // This is the user's ID
  username: string;
  role: string | null;
}

export interface AuditLog {
    id: string;
    organization_id: string;
    user_id: string;
    action: string;
    details: Record<string, any>;
    created_at: string | Date;
}


export interface EvolutionInstance {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  status: 'online' | 'offline' | 'unconfigured' | 'connecting';
}

export interface ChatwootInstance {
  id: string;
  name: string;
  baseUrl: string;
  apiAccessToken: string;
  status: 'online' | 'offline' | 'unconfigured' | 'connecting';
}

export interface SmtpSettings {
    id: string;
    organization_id: string;
    host: string;
    port: number;
    secure: boolean;
    username?: string | null;
    password?: string | null;
    from_name?: string | null;
    from_email?: string | null;
    created_at: string | Date;
    updated_at: string | Date;
}

// --- NEW RBAC TYPES ---

export type PermissionAction = 'create' | 'read' | 'update' | 'delete';
export type PermissionSubject = 'Workspace' | 'User' | 'Billing' | 'OrganizationSettings' | 'Role';
export type PermissionIdentifier = `${Lowercase<PermissionSubject>}:${PermissionAction}`;

export interface Permission {
    id: PermissionIdentifier;
    description: string;
    subject: PermissionSubject;
}

export interface Role {
    id: string; // UUID
    organization_id: string;
    name: string;
    description?: string;
    permissions: PermissionIdentifier[];
    is_system_role?: boolean; // Para distinguir 'Admin', 'Membro' de cargos customizados
}
