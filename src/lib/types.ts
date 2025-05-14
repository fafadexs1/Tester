
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
  | 'intelligent-agent';

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

  // Para 'whatsapp-*' e envio via WhatsApp em nós genéricos
  instanceName?: string; 
  phoneNumber?: string; // Usado por blocos específicos de WhatsApp
  textMessage?: string; // Usado por blocos específicos de WhatsApp
  mediaUrl?: string; // Usado por blocos específicos de WhatsApp
  mediaType?: 'image' | 'video' | 'document' | 'audio'; // Usado por blocos específicos de WhatsApp
  caption?: string; // Usado por blocos específicos de WhatsApp
  groupName?: string; // Usado por blocos específicos de WhatsApp
  participants?: string; // Usado por blocos específicos de WhatsApp
  
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
  userInputVariable?: string; 
  agentResponseVariable?: string; 
  maxConversationTurns?: number;
  temperature?: number; 

  // Campos para ativar WhatsApp em nós genéricos
  sendViaWhatsApp?: boolean;
  whatsappTargetPhoneNumber?: string; // Telefone de destino para mensagens via WhatsApp de nós genéricos
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
