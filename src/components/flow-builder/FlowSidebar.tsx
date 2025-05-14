
"use client";

import type React from 'react';
import DraggableBlock from './DraggableBlock';
import {
  MessageSquareText, Type, ListChecks, GitFork, Variable, Timer, Webhook,
  BotMessageSquare, ImageUp, UserPlus2, CalendarDays, ExternalLink, MoreHorizontal, FileImage
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const FlowSidebar: React.FC = () => {
  const iconProps = { className: "w-4 h-4" };

  return (
    <aside className="w-80 bg-sidebar border-r border-sidebar-border shadow-lg flex flex-col">
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
            defaultData={{ mediaDisplayType: 'image', mediaDisplayUrl: 'https://picsum.photos/200/300', mediaDisplayText: 'Imagem de exemplo' }} />
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
        </div>
        
        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Integrações</h3>
          <DraggableBlock type="api-call" label="Chamada API" icon={<Webhook {...iconProps} className="text-red-600" />} 
            defaultData={{ apiUrl: 'https://', apiMethod: 'GET' }}/>
          <DraggableBlock type="redirect" label="Redirecionar URL" icon={<ExternalLink {...iconProps} className="text-lime-600" />}
            defaultData={{ redirectUrl: 'https://google.com' }} />
          <DraggableBlock type="date-input" label="Entrada de Data" icon={<CalendarDays {...iconProps} className="text-sky-600" />}
            defaultData={{ dateInputLabel: 'Qual sua data de nascimento?', variableToSaveDate: 'data_nascimento' }} />
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">API Evolution (WhatsApp)</h3>
          <DraggableBlock type="whatsapp-text" label="Enviar Texto (WA)" icon={<BotMessageSquare {...iconProps} className="text-teal-600" />} 
            defaultData={{ textMessage: 'Olá!', instanceName: 'evolution_instance' }} />
          <DraggableBlock type="whatsapp-media" label="Enviar Mídia (WA)" icon={<ImageUp {...iconProps} className="text-indigo-600" />} 
            defaultData={{ mediaType: 'image', instanceName: 'evolution_instance' }} />
          <DraggableBlock type="whatsapp-group" label="Criar Grupo (WA)" icon={<UserPlus2 {...iconProps} className="text-pink-600" />} 
            defaultData={{ groupName: 'Novo Grupo', instanceName: 'evolution_instance' }} />
        </div>
      </ScrollArea>
    </aside>
  );
};

export default FlowSidebar;
