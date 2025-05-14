
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
  // Novos tipos de nós
  | 'log-console'         // Para registrar mensagens no console (para debugging)
  | 'code-execution'      // Para executar trechos de código JavaScript (server-side)
  | 'json-transform'      // Para transformar dados JSON usando JSONata ou similar
  | 'file-upload'         // Para permitir que o usuário faça upload de um arquivo
  | 'rating-input'        // Para coletar uma avaliação do usuário (estrelas, etc.)
  | 'ai-text-generation'  // Para gerar texto usando um modelo de IA
  | 'send-email'          // Para enviar e-mails
  | 'google-sheets-append'; // Para adicionar uma linha a uma Planilha Google

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
  logMessage?: string; // PT: Mensagem para Log

  // Para 'code-execution'
  codeSnippet?: string; // PT: Trecho de Código (JS)
  codeOutputVariable?: string; // PT: Salvar Saída na Variável

  // Para 'json-transform'
  inputJson?: string; // PT: JSON de Entrada (ou variável)
  jsonataExpression?: string; // PT: Expressão JSONata
  jsonOutputVariable?: string; // PT: Salvar JSON Transformado na Variável

  // Para 'file-upload'
  uploadPromptText?: string; // PT: Texto do Prompt de Upload
  fileTypeFilter?: string; // PT: Filtro de Tipo de Arquivo (ex: image/*, .pdf)
  maxFileSizeMB?: number; // PT: Tam. Máx. Arquivo (MB)
  fileUrlVariable?: string; // PT: Salvar URL do Arquivo na Variável

  // Para 'rating-input'
  ratingQuestionText?: string; // PT: Pergunta da Avaliação
  maxRatingValue?: number; // PT: Avaliação Máxima (ex: 5)
  ratingIconType?: 'star' | 'heart' | 'number'; // PT: Ícone de Avaliação
  ratingOutputVariable?: string; // PT: Salvar Avaliação na Variável

  // Para 'ai-text-generation'
  aiPromptText?: string; // PT: Prompt para IA
  aiModelName?: string; // PT: Modelo de IA (opcional)
  aiOutputVariable?: string; // PT: Salvar Resposta da IA na Variável
  
  // Para 'send-email'
  emailTo?: string; // PT: Para (E-mail)
  emailSubject?: string; // PT: Assunto
  emailBody?: string; // PT: Corpo do E-mail (HTML/Texto)
  emailFrom?: string; // PT: De (E-mail - opcional)

  // Para 'google-sheets-append'
  googleSheetId?: string; // PT: ID da Planilha Google
  googleSheetName?: string; // PT: Nome da Aba
  googleSheetRowData?: string; // PT: Dados da Linha (JSON array ou CSV)
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
