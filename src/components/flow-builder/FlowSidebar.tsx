
"use client";

import type React from 'react';
import type { WorkspaceData } from '@/lib/types';
import DraggableBlock from './DraggableBlock';
import {
  MessageSquareText, Type, ListChecks, GitFork, Variable, Timer, Webhook,
  BotMessageSquare, ImageUp, UserPlus2, CalendarDays, ExternalLink, MoreHorizontal, FileImage,
  TerminalSquare, Code2, Shuffle, UploadCloud, Star, Sparkles, Mail, Sheet, BrainCircuit, Headset, PlusCircle
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';


interface FlowSidebarProps {
  workspaces: WorkspaceData[];
  activeWorkspaceId: string | null;
  onAddWorkspace: () => void;
  onSwitchWorkspace: (id: string) => void;
  // onDeleteWorkspace?: (id: string) => void; // Futuro
  // onRenameWorkspace?: (id: string, newName: string) => void; // Futuro
}


const FlowSidebar: React.FC<FlowSidebarProps> = ({
  workspaces, activeWorkspaceId, onAddWorkspace, onSwitchWorkspace
}) => {
  const iconProps = { className: "w-4 h-4" };

  return (
    <aside className="w-80 bg-sidebar border-r border-sidebar-border shadow-lg flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Workspaces</h2>
        <Button onClick={onAddWorkspace} className="w-full mt-2" variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" /> Novo Fluxo
        </Button>
        {workspaces.length > 0 && activeWorkspaceId && (
          <div className="mt-4">
            <Label htmlFor="workspace-select" className="text-sidebar-foreground/80">Fluxo Ativo</Label>
            <Select
              value={activeWorkspaceId}
              onValueChange={onSwitchWorkspace}
            >
              <SelectTrigger id="workspace-select" className="mt-1 bg-card text-card-foreground">
                <SelectValue placeholder="Selecione um fluxo" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map(ws => (
                  <SelectItem key={ws.id} value={ws.id}>
                    {ws.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Blocos de Fluxo</h2>
      </div>
      <ScrollArea className="flex-grow p-4 space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Básicos</h3>
          <DraggableBlock type="message" label="Exibir Texto" icon={<MessageSquareText {...iconProps} color="hsl(var(--accent))" />} 
            defaultData={{ text: 'Olá!'}} />
          <DraggableBlock type="input" label="Entrada do Usuário" icon={<Type {...iconProps} className="text-green-600" />} 
            defaultData={{ inputType: 'text', promptText: 'Qual é o seu nome?', variableToSaveResponse: 'nome_usuario' }} />
          <DraggableBlock type="option" label="Múltiplas Escolhas" icon={<ListChecks {...iconProps} className="text-purple-600" />} 
            defaultData={{ questionText: 'Escolha uma opção:', optionsList: 'Opção A\nOpção B', variableToSaveChoice: 'escolha_usuario' }}/>
          <DraggableBlock type="media-display" label="Exibir Mídia" icon={<FileImage {...iconProps} className="text-blue-500" />}
            defaultData={{ mediaDisplayType: 'image', mediaDisplayUrl: 'https://placehold.co/300x200.png', mediaDisplayText: 'Imagem de exemplo' }} />
          <DraggableBlock type="rating-input" label="Entrada de Avaliação" icon={<Star {...iconProps} className="text-yellow-400" />}
            defaultData={{ ratingQuestionText: 'Como você avalia nosso serviço?', maxRatingValue: 5, ratingIconType: 'star', ratingOutputVariable: 'avaliacao_servico' }} />
          <DraggableBlock type="file-upload" label="Upload de Arquivo" icon={<UploadCloud {...iconProps} className="text-fuchsia-500" />}
            defaultData={{ uploadPromptText: 'Por favor, envie seu arquivo.', maxFileSizeMB: 5, fileUrlVariable: 'url_arquivo_enviado' }} />
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Lógica e Controle</h3>
          <DraggableBlock type="condition" label="Condição (Se/Então)" icon={<GitFork {...iconProps} className="text-orange-600" />} 
            defaultData={{ conditionVariable: '{{input.variavel}}', conditionOperator: '==', conditionValue: 'valor_esperado' }}/>
          <DraggableBlock type="set-variable" label="Definir Variável" icon={<Variable {...iconProps} className="text-cyan-600" />} 
            defaultData={{ variableName: 'novaVariavel', variableValue: '123' }}/>
          <DraggableBlock type="delay" label="Atraso" icon={<Timer {...iconProps} className="text-yellow-500" />} 
            defaultData={{ delayDuration: 1000 }}/>
          <DraggableBlock type="typing-emulation" label="Simular Digitação" icon={<MoreHorizontal {...iconProps} className="text-gray-500" />}
            defaultData={{ typingDuration: 1500 }} />
          <DraggableBlock type="log-console" label="Registrar no Console" icon={<TerminalSquare {...iconProps} className="text-slate-500" />}
            defaultData={{ logMessage: 'Log: {{input.status}}' }} />
          <DraggableBlock type="code-execution" label="Executar Código (JS)" icon={<Code2 {...iconProps} className="text-amber-500" />}
            defaultData={{ codeSnippet: "return { resultado: 'sucesso' };", codeOutputVariable: 'resultado_codigo' }} />
           <DraggableBlock type="json-transform" label="Transformar JSON" icon={<Shuffle {...iconProps} className="text-violet-500" />}
            defaultData={{ inputJson: '{ "nome": "Exemplo" }', jsonataExpression: '$.nome', jsonOutputVariable: 'nome_transformado' }} />
        </div>
        
        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Inteligência Artificial</h3>
          <DraggableBlock type="ai-text-generation" label="Gerar Texto com IA" icon={<Sparkles {...iconProps} className="text-rose-500" />}
            defaultData={{ aiPromptText: 'Resuma o seguinte texto: {{input.texto_longo}}', aiOutputVariable: 'texto_resumido_ia' }} />
          <DraggableBlock 
            type="intelligent-agent" 
            label="Agente Inteligente" 
            icon={<Headset {...iconProps} className="text-sky-500" />} 
            defaultData={{ 
              agentName: 'Agente de Suporte', 
              agentSystemPrompt: 'Você é um agente de suporte virtual. Ajude o usuário com suas dúvidas.', 
              userInputVariable: '{{pergunta_do_usuario}}',
              agentResponseVariable: 'resposta_do_agente',
              aiModelName: 'gemini-2.0-flash',
              maxConversationTurns: 5,
              temperature: 0.7,
            }} 
          />
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Integrações</h3>
          <DraggableBlock type="api-call" label="Chamada API" icon={<Webhook {...iconProps} className="text-red-600" />} 
            defaultData={{ apiUrl: 'https://', apiMethod: 'GET' }}/>
          <DraggableBlock type="redirect" label="Redirecionar URL" icon={<ExternalLink {...iconProps} className="text-lime-600" />}
            defaultData={{ redirectUrl: 'https://google.com' }} />
          <DraggableBlock type="date-input" label="Entrada de Data" icon={<CalendarDays {...iconProps} className="text-sky-600" />}
            defaultData={{ dateInputLabel: 'Qual sua data de nascimento?', variableToSaveDate: 'data_nascimento' }} />
          <DraggableBlock type="send-email" label="Enviar E-mail" icon={<Mail {...iconProps} className="text-blue-600" />}
            defaultData={{ emailTo: 'destinatario@exemplo.com', emailSubject: 'Assunto do E-mail', emailBody: 'Olá, {{input.nome}}!' }} />
          <DraggableBlock type="google-sheets-append" label="Adicionar Linha Planilha Google" icon={<Sheet {...iconProps} className="text-emerald-500" />}
            defaultData={{ googleSheetId: 'SEU_SPREADSHEET_ID', sheetName: 'Página1', googleSheetRowData: '["{{input.campo1}}", "{{input.campo2}}"]' }} />
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">API Evolution (WhatsApp)</h3>
          <DraggableBlock type="whatsapp-text" label="Enviar Texto (WA)" icon={<BotMessageSquare {...iconProps} className="text-teal-600" />} 
            defaultData={{ textMessage: 'Olá!', instanceName: 'evolution_instance' }} />
          <DraggableBlock type="whatsapp-media" label="Enviar Mídia (WA)" icon={<ImageUp {...iconProps} className="text-indigo-600" />} 
            defaultData={{ mediaType: 'image', instanceName: 'evolution_instance', mediaUrl: 'https://placehold.co/300x200.png' }} />
          <DraggableBlock type="whatsapp-group" label="Criar Grupo (WA)" icon={<UserPlus2 {...iconProps} className="text-pink-600" />} 
            defaultData={{ groupName: 'Novo Grupo', instanceName: 'evolution_instance' }} />
        </div>
      </ScrollArea>
    </aside>
  );
};

export default FlowSidebar;
