
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
  | 'intelligent-agent'; // Novo tipo de nó

export interface NodeData {
  id: string;
  type: NodeType;
  title: string;
  x: number;
  y: number;
  
  // Propriedades específicas dos tipos de nó
  text?: string; // Para 'message'
  
  // Para 'input'
  promptText?: string; 
  inputType?: 'text' | 'email' | 'phone' | 'number';
  variableToSaveResponse?: string;

  // Para 'option'
  questionText?: string;
  optionsList?: string; // string, uma opção por linha
  variableToSaveChoice?: string;

  // Para 'whatsapp-*'
  instanceName?: string; 
  phoneNumber?: string; 
  textMessage?: string; 
  mediaUrl?: string; 
  mediaType?: 'image' | 'video' | 'document' | 'audio'; 
  caption?: string; 
  groupName?: string; 
  participants?: string; 
  
  // Para 'condition'
  conditionVariable?: string; 
  conditionOperator?: '==' | '!=' | '>' | '<' | 'contains' | 'startsWith' | 'endsWith'; 
  conditionValue?: string; 
  
  // Para 'set-variable'
  variableName?: string; 
  variableValue?: string; 
  
  // Para 'api-call'
  apiUrl?: string; 
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE'; 
  apiHeaders?: string; // JSON string
  apiBody?: string; // JSON string
  
  // Para 'delay'
  delayDuration?: number; // em ms

  // Para 'date-input'
  dateInputLabel?: string;
  variableToSaveDate?: string;

  // Para 'redirect'
  redirectUrl?: string;

  // Para 'typing-emulation'
  typingDuration?: number; // em ms

  // Para 'media-display'
  mediaDisplayType?: 'image' | 'video' | 'audio';
  mediaDisplayUrl?: string;
  mediaDisplayText?: string; // alt text ou legenda

  // Para 'log-console'
  logMessage?: string;

  // Para 'code-execution'
  codeSnippet?: string;
  codeOutputVariable?: string;

  // Para 'json-transform'
  inputJson?: string;
  jsonataExpression?: string;
  jsonOutputVariable?: string;

  // Para 'file-upload'
  uploadPromptText?: string;
  fileTypeFilter?: string;
  maxFileSizeMB?: number;
  fileUrlVariable?: string;

  // Para 'rating-input'
  ratingQuestionText?: string;
  maxRatingValue?: number;
  ratingIconType?: 'star' | 'heart' | 'number';
  ratingOutputVariable?: string;

  // Para 'ai-text-generation'
  aiPromptText?: string;
  aiModelName?: string;
  aiOutputVariable?: string;
  
  // Para 'send-email'
  emailTo?: string;
  emailSubject?: string;
  emailBody?: string;
  emailFrom?: string;

  // Para 'google-sheets-append'
  googleSheetId?: string;
  googleSheetName?: string;
  googleSheetRowData?: string;

  // Para 'intelligent-agent'
  agentName?: string;
  agentSystemPrompt?: string;
  userInputVariable?: string; // Variável contendo a pergunta do usuário para o agente
  agentResponseVariable?: string; // Variável para salvar a resposta do agente
  // aiModelName já existe em ai-text-generation, pode ser reutilizado ou ter um específico.
  maxConversationTurns?: number;
  temperature?: number; // 0.0 to 1.0
}

export interface Connection {
  id: string;
  from: string; // ID do nó de origem
  to: string;   // ID do nó de destino
  sourceHandle?: string; // ex: 'true', 'false' para condição, 'default' para outros
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
