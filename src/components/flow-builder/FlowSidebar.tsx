
"use client";

import type React from 'react';
import DraggableBlock from './DraggableBlock';
import {
  MessageCircle, TerminalSquare, List, GitFork, Variable, Timer, Webhook,
  BotMessageSquare, ImageUp, UserPlus2
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

const FlowSidebar: React.FC = () => {
  const iconProps = { className: "w-4 h-4" };

  return (
    <aside className="w-80 bg-sidebar border-r border-sidebar-border shadow-lg flex flex-col">
      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Flow Blocks</h2>
      </div>
      <ScrollArea className="flex-grow p-4 space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Basics</h3>
          <DraggableBlock type="message" label="Generic Message" icon={<MessageCircle {...iconProps} color="hsl(var(--accent))" />} />
          <DraggableBlock type="input" label="User Input" icon={<TerminalSquare {...iconProps} className="text-green-600" />} />
          <DraggableBlock type="option" label="Multiple Options" icon={<List {...iconProps} className="text-purple-600" />} />
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Logic & Control</h3>
          <DraggableBlock type="condition" label="Condition (If/Else)" icon={<GitFork {...iconProps} className="text-orange-600" />} 
            defaultData={{ conditionVariable: '{{input.variable}}', conditionOperator: '==', conditionValue: 'expected_value' }}/>
          <DraggableBlock type="set-variable" label="Set Variable" icon={<Variable {...iconProps} className="text-cyan-600" />} 
            defaultData={{ variableName: 'newVariable', variableValue: '123' }}/>
          <DraggableBlock type="delay" label="Delay" icon={<Timer {...iconProps} className="text-yellow-500" />} 
            defaultData={{ delayDuration: 1000 }}/>
        </div>
        
        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Integrations</h3>
          <DraggableBlock type="api-call" label="API Call" icon={<Webhook {...iconProps} className="text-red-600" />} 
            defaultData={{ apiUrl: 'https://', apiMethod: 'GET' }}/>
        </div>

        <div className="mt-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Evolution API (WhatsApp)</h3>
          <DraggableBlock type="whatsapp-text" label="Send Text (WA)" icon={<BotMessageSquare {...iconProps} className="text-teal-600" />} 
            defaultData={{ textMessage: 'Hello!', instanceName: 'evolution_instance' }} />
          <DraggableBlock type="whatsapp-media" label="Send Media (WA)" icon={<ImageUp {...iconProps} className="text-indigo-600" />} 
            defaultData={{ mediaType: 'image', instanceName: 'evolution_instance' }} />
          <DraggableBlock type="whatsapp-group" label="Create Group (WA)" icon={<UserPlus2 {...iconProps} className="text-pink-600" />} 
            defaultData={{ groupName: 'New Group', instanceName: 'evolution_instance' }} />
        </div>
      </ScrollArea>
    </aside>
  );
};

export default FlowSidebar;
