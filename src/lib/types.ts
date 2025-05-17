
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

export interface StartNodeTrigger {
  id: string;
  name: string;
  type: 'manual' | 'webhook';
  webhookId?: string; 
  webhookPayloadVariable?: string; 
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

  // Option Node
  questionText?: string;
  optionsList?: string; 
  variableToSaveChoice?: string;

  // WhatsApp Nodes
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
  conditionOperator?: '==' | '!=' | '>' | '<' | 'contains' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty'; 
  conditionValue?: string; 
  
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
  fileTypeFilter?: string;
  maxFileSizeMB?: number;
  fileUrlVariable?: string;

  // Rating Input Node
  ratingQuestionText?: string;
  maxRatingValue?: number;
  ratingIconType?: 'star' | 'heart' | 'number';
  ratingOutputVariable?: string;

  // AI Text Generation Node
  aiPromptText?: string;
  aiModelName?: string; // e.g., gemini-1.5-flash
  aiOutputVariable?: string;
  
  // Send Email Node
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailFrom?: string; // Optional

  // Google Sheets Append Node
  googleSheetId?: string;
  googleSheetName?: string; // e.g., "Página1"
  googleSheetRowData?: string; // JSON string array, e.g., '["{{val1}}", "valor2"]'

  // Intelligent Agent Node
  agentName?: string;
  agentSystemPrompt?: string;
  userInputVariable?: string; // Variable holding the user's current message to the agent
  agentResponseVariable?: string; // Variable to store the agent's response
  maxConversationTurns?: number; // Optional: To limit conversation length for state management
  temperature?: number; // Optional: For LLM creativity

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
  sourceHandleId: string; // 'default', trigger name, or option text
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
}
