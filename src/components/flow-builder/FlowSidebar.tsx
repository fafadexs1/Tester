
"use client";

import React from 'react'; // Ensure React is imported
import DraggableBlock from './DraggableBlock';
import {
  MessageSquareText, Type, ListChecks, GitFork, Variable, Timer, Webhook,
  BotMessageSquare, ImageUp, UserPlus2, CalendarDays, ExternalLink, MoreHorizontal, FileImage,
  TerminalSquare, Code2, Shuffle, UploadCloud, Star, Sparkles, Mail, Sheet, BrainCircuit, Headset, 
  Database, Rows, Search, Edit3, PlayCircle, PlusCircle, GripVertical, TestTube2, Braces, KeyRound, StopCircle, MousePointerClick, Hourglass, GitCommitHorizontal, Trash2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { v4 as uuidv4 } from 'uuid';
import type { StartNodeTrigger } from '@/lib/types';


interface FlowSidebarProps {}

const FlowSidebarComponent: React.FC<FlowSidebarProps> = () => {
  const iconProps = { className: "w-5 h-5" };
  
  const defaultTriggers: StartNodeTrigger[] = [
    { id: uuidv4(), name: 'Manual', type: 'manual', enabled: true },
    { 
      id: uuidv4(), 
      name: 'Webhook', 
      type: 'webhook', 
      enabled: false, 
      variableMappings: [], 
      sessionTimeoutSeconds: 0 
    },
  ];

  const blockCategories = [
    {
      value: "basic",
      title: "Básicos",
      blocks: [
        { type: "start", label: "Início do Fluxo", icon: <PlayCircle {...iconProps} color="hsl(var(--primary))" />, description: "Começa a execução do fluxo.", defaultData: { triggers: defaultTriggers } },
        { type: "message", label: "Exibir Texto", icon: <MessageSquareText {...iconProps} color="hsl(var(--accent))" />, description: "Mostra uma mensagem de texto.", defaultData: { text: 'Olá!'} },
        { type: "input", label: "Entrada do Usuário", icon: <Type {...iconProps} className="text-green-500" />, description: "Solicita e salva uma resposta.", defaultData: { inputType: 'text', promptText: 'Qual é o seu nome?', variableToSaveResponse: 'nome_usuario', apiResponseAsInput: false, apiResponsePathForValue: 'responseText' } },
        { type: "option", label: "Múltiplas Escolhas", icon: <ListChecks {...iconProps} className="text-purple-500" />, description: "Apresenta opções para o usuário.", defaultData: { questionText: 'Escolha uma opção:', optionsList: 'Opção A\nOpção B', variableToSaveChoice: 'escolha_usuario', apiResponseAsInput: false, apiResponsePathForValue: 'optionChoice' }},
        { type: "media-display", label: "Exibir Mídia", icon: <FileImage {...iconProps} className="text-blue-500" />, description: "Mostra uma imagem, vídeo ou áudio.", defaultData: { mediaDisplayType: 'image', mediaDisplayUrl: 'https://placehold.co/300x200.png', dataAiHint: 'placeholder abstract', mediaDisplayText: 'Imagem de exemplo' } },
        { type: "rating-input", label: "Entrada de Avaliação", icon: <Star {...iconProps} className="text-yellow-400" />, description: "Coleta uma avaliação em escala.", defaultData: { ratingQuestionText: 'Como você avalia nosso serviço?', maxRatingValue: 5, ratingIconType: 'star', ratingOutputVariable: 'avaliacao_servico', apiResponseAsInput: false, apiResponsePathForValue: '' } },
        { type: "file-upload", label: "Upload de Arquivo", icon: <UploadCloud {...iconProps} className="text-fuchsia-500" />, description: "Permite que o usuário envie um arquivo.", defaultData: { uploadPromptText: 'Por favor, envie seu arquivo.', maxFileSizeMB: 5, fileUrlVariable: 'url_arquivo_enviado', apiResponseAsInput: false, apiResponsePathForValue: '' } },
        { type: "end-flow", label: "Fim do Fluxo", icon: <StopCircle {...iconProps} className="text-destructive" />, description: "Encerra a execução do fluxo.", defaultData: {} },
      ]
    },
    {
      value: "logic",
      title: "Lógica e Controle",
      blocks: [
        { type: "condition", label: "Condição (Se/Então)", icon: <GitFork {...iconProps} className="text-orange-500" />, description: "Desvia o fluxo baseado em regras.", defaultData: { conditionVariable: '{{input.variavel}}', conditionOperator: '==', conditionValue: 'valor_esperado' }},
        { type: "switch", label: "Escolha de Caminho", icon: <GitCommitHorizontal {...iconProps} className="text-indigo-500" />, description: "Desvia o fluxo para múltiplos caminhos.", defaultData: { switchVariable: '{{status}}', switchCases: [{id: uuidv4(), value: 'aprovado'}, {id: uuidv4(), value: 'recusado'}] }},
        { type: "set-variable", label: "Definir Variável", icon: <Variable {...iconProps} className="text-cyan-500" />, description: "Cria ou atualiza uma variável.", defaultData: { variableName: 'nova_variavel', variableValue: '123' }},
        { type: "delay", label: "Atraso", icon: <Timer {...iconProps} className="text-yellow-500" />, description: "Pausa o fluxo por um tempo.", defaultData: { delayDuration: 1000 }},
        { type: "typing-emulation", label: "Simular Digitação", icon: <MoreHorizontal {...iconProps} className="text-gray-500" />, description: "Exibe o indicador 'digitando'.", defaultData: { typingDuration: 1500 } },
        { type: "log-console", label: "Registrar no Console", icon: <TerminalSquare {...iconProps} className="text-slate-500" />, description: "Imprime dados no log do servidor.", defaultData: { logMessage: 'Log: {{input.status}}' } },
        { type: "code-execution", label: "Executar Código (JS)", icon: <Code2 {...iconProps} className="text-amber-500" />, description: "Roda um script JavaScript no servidor.", defaultData: { codeSnippet: "return { resultado: 'sucesso' };", codeOutputVariable: 'resultado_codigo' } },
        { type: "json-transform", label: "Transformar JSON", icon: <Shuffle {...iconProps} className="text-violet-500" />, description: "Manipula dados JSON com JSONata.", defaultData: { inputJson: '{ "nome": "Exemplo" }', jsonataExpression: '$.nome', jsonOutputVariable: 'nome_transformado' } },
      ]
    },
    {
      value: "ai",
      title: "Inteligência Artificial",
      blocks: [
        { type: "ai-text-generation", label: "Gerar Texto com IA", icon: <Sparkles {...iconProps} className="text-rose-500" />, description: "Usa Genkit para gerar conteúdo.", defaultData: { aiPromptText: 'Resuma o seguinte texto: {{input.texto_longo}}', aiOutputVariable: 'texto_resumido_ia' } },
        { type: "intelligent-agent", label: "Agente Inteligente", icon: <BrainCircuit {...iconProps} className="text-sky-500" />, description: "Cria um assistente conversacional.", defaultData: { agentName: 'Agente de Suporte', agentSystemPrompt: 'Você é um agente de suporte virtual. Ajude o usuário com suas dúvidas.', userInputVariable: '{{pergunta_do_usuario}}', agentResponseVariable: 'resposta_do_agente', aiModelName: 'gemini-pro', maxConversationTurns: 5, temperature: 0.7,}}
      ]
    },
    {
      value: "integrations",
      title: "Integrações",
      blocks: [
        { type: "api-call", label: "Chamada API", icon: <Webhook {...iconProps} className="text-red-500" />, description: "Conecta-se a serviços externos.", defaultData: { apiUrl: 'https://', apiMethod: 'GET', apiOutputVariable: 'resposta_api' }},
        { type: "dialogy-send-message", label: "Enviar Mensagem (Dialogy)", icon: <MessageSquareText {...iconProps} className="text-orange-500" />, description: "Envia uma mensagem via Dialogy.", defaultData: { dialogyChatId: '{{dialogy_conversation_id}}', dialogyMessageContent: 'Olá, vindo do NexusFlow!' }},
        { type: "redirect", label: "Redirecionar URL", icon: <ExternalLink {...iconProps} className="text-lime-500" />, description: "Envia o usuário para uma URL.", defaultData: { redirectUrl: 'https://google.com' } },
        { type: "date-input", label: "Entrada de Data", icon: <CalendarDays {...iconProps} className="text-teal-500" />, description: "Coleta uma data do usuário.", defaultData: { dateInputLabel: 'Qual sua data de nascimento?', variableToSaveDate: 'data_nascimento', apiResponseAsInput: false, apiResponsePathForValue: '' } },
        { type: "send-email", label: "Enviar E-mail", icon: <Mail {...iconProps} className="text-blue-500" />, description: "Dispara um e-mail (requer config).", defaultData: { emailTo: 'destinatario@exemplo.com', emailSubject: 'Assunto do E-mail', emailBody: 'Olá, {{input.nome}}!' } },
        { type: "google-sheets-append", label: "Adicionar Linha Planilha Google", icon: <Sheet {...iconProps} className="text-emerald-500" />, description: "Escreve dados em uma planilha.", defaultData: { googleSheetId: 'SEU_SPREADSHEET_ID', googleSheetName: 'Página1', googleSheetRowData: '["{{input.valor1}}", "{{input.valor2}}", "texto fixo"]' } },
      ]
    },
    {
      value: "supabase",
      title: "Supabase",
      blocks: [
        { type: "supabase-create-row", label: "Criar Linha", icon: <PlusCircle {...iconProps} className="text-green-500" />, description: "Adiciona um novo registro.", defaultData: { supabaseTableName: '', supabaseDataJson: '{ "coluna": "valor" }', supabaseResultVariable: 'id_linha_criada_supabase' } },
        { type: "supabase-read-row", label: "Ler Linha(s)", icon: <Search {...iconProps} className="text-blue-500" />, description: "Busca registros em uma tabela.", defaultData: { supabaseTableName: '', supabaseIdentifierColumn: '', supabaseIdentifierValue: '', supabaseColumnsToSelect: '*', supabaseResultVariable: 'dados_supabase'} },
        { type: "supabase-update-row", label: "Atualizar Linha", icon: <Edit3 {...iconProps} className="text-yellow-500" />, description: "Modifica um registro existente.", defaultData: { supabaseTableName: '', supabaseIdentifierColumn: '', supabaseIdentifierValue: '', supabaseDataJson: '{ "coluna": "novo_valor" }' } },
        { type: "supabase-delete-row", label: "Deletar Linha", icon: <Trash2 {...iconProps} className="text-red-500" />, description: "Remove um registro da tabela.", defaultData: { supabaseTableName: '', supabaseIdentifierColumn: '', supabaseIdentifierValue: '' } },
      ]
    },
    {
      value: "whatsapp",
      title: "API Evolution (WhatsApp)",
      blocks: [
        { type: "whatsapp-text", label: "Enviar Texto (WA)", icon: <BotMessageSquare {...iconProps} className="text-teal-600" />, description: "Envia uma mensagem de texto.", defaultData: { textMessage: 'Olá!', instanceName: 'evolution_instance' } },
        { type: "whatsapp-media", label: "Enviar Mídia (WA)", icon: <ImageUp {...iconProps} className="text-indigo-600" />, description: "Envia imagem, vídeo, áudio, etc.", defaultData: { mediaType: 'image', instanceName: 'evolution_instance', mediaUrl: 'https://placehold.co/300x200.png', dataAiHint: 'placeholder abstract' } },
        { type: "whatsapp-group", label: "Criar Grupo (WA)", icon: <UserPlus2 {...iconProps} className="text-pink-600" />, description: "Cria um grupo com participantes.", defaultData: { groupName: 'Novo Grupo', instanceName: 'evolution_instance' } },
      ]
    }
  ];

  return (
    <aside className="w-80 bg-sidebar border-r border-sidebar-border shadow-lg flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Blocos de Fluxo</h2>
      </div>
      <ScrollArea className="flex-grow">
        <Accordion type="multiple" className="w-full px-2 py-2" defaultValue={blockCategories.map(cat => cat.value)}>
          {blockCategories.map(category => (
            <AccordionItem value={category.value} key={category.value} className="border-none">
              <AccordionTrigger className="text-sm font-medium text-sidebar-foreground/90 hover:text-sidebar-foreground px-2 py-2.5 rounded-md hover:bg-muted">
                {category.title}
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-3">
                <div className="grid grid-cols-1 gap-2">
                  {category.blocks.map(block => (
                    <DraggableBlock 
                      key={block.type}
                      type={block.type}
                      label={block.label}
                      icon={block.icon}
                      description={block.description}
                      defaultData={block.defaultData}
                    />
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </ScrollArea>
    </aside>
  );
};

const FlowSidebar = React.memo(FlowSidebarComponent);
FlowSidebar.displayName = 'FlowSidebar';

export default FlowSidebar;
