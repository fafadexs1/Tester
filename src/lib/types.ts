
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
  | 'supabase-delete-row';

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

export interface NodeData {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  dataAiHint?: string; 
  
  text?: string; 
  
  promptText?: string; 
  inputType?: 'text' | 'email' | 'phone' | 'number';
  variableToSaveResponse?: string;

  questionText?: string;
  optionsList?: string; 
  variableToSaveChoice?: string;

  instanceName?: string; 
  phoneNumber?: string; 
  textMessage?: string; 
  mediaUrl?: string; 
  mediaType?: 'image' | 'video' | 'document' | 'audio'; 
  caption?: string; 
  groupName?: string; 
  participants?: string; 
  
  conditionVariable?: string; 
  conditionOperator?: '==' | '!=' | '>' | '<' | 'contains' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty'; 
  conditionValue?: string; 
  
  variableName?: string; 
  variableValue?: string; 
  
  // Para 'api-call' - Campos Reformulados
  apiUrl?: string; 
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; 
  apiAuthType?: 'none' | 'bearer' | 'basic';
  apiAuthBearerToken?: string;
  apiAuthBasicUser?: string;
  apiAuthBasicPassword?: string;
  apiHeadersList?: ApiHeader[];
  apiQueryParamsList?: ApiQueryParam[];
  apiBodyType?: 'none' | 'json' | 'form-data' | 'raw';
  apiBodyJson?: string; // Usado se apiBodyType for 'json'
  apiBodyFormDataList?: ApiFormDataEntry[]; // Usado se apiBodyType for 'form-data'
  apiBodyRaw?: string; // Usado se apiBodyType for 'raw'
  apiOutputVariable?: string;
  
  delayDuration?: number; 

  dateInputLabel?: string;
  variableToSaveDate?: string;

  redirectUrl?: string;

  typingDuration?: number; 

  mediaDisplayType?: 'image' | 'video' | 'audio';
  mediaDisplayUrl?: string;
  mediaDisplayText?: string; 

  logMessage?: string;

  codeSnippet?: string;
  codeOutputVariable?: string;

  inputJson?: string;
  jsonataExpression?: string;
  jsonOutputVariable?: string;

  uploadPromptText?: string;
  fileTypeFilter?: string;
  maxFileSizeMB?: number;
  fileUrlVariable?: string;

  ratingQuestionText?: string;
  maxRatingValue?: number;
  ratingIconType?: 'star' | 'heart' | 'number';
  ratingOutputVariable?: string;

  aiPromptText?: string;
  aiModelName?: string;
  aiOutputVariable?: string;
  
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailFrom?: string;

  googleSheetId?: string;
  googleSheetName?: string;
  googleSheetRowData?: string;

  agentName?: string;
  agentSystemPrompt?: string;
  userInputVariable?: string; 
  agentResponseVariable?: string; 
  maxConversationTurns?: number;
  temperature?: number; 

  sendViaWhatsApp?: boolean;
  whatsappTargetPhoneNumber?: string; 

  supabaseTableName?: string;
  supabaseIdentifierColumn?: string; 
  supabaseIdentifierValue?: string; 
  supabaseDataJson?: string; 
  supabaseColumnsToSelect?: string; 
  supabaseResultVariable?: string; 
  supabaseReturnSingleValue?: boolean; // Novo campo para nó de leitura
  supabaseSingleValueColumn?: string; // Novo campo para nó de leitura

  triggers?: string[];
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
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
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

