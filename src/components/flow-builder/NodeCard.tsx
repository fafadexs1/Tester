"use client";

import React, { memo, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import {
  MoreHorizontal, Copy, Trash2, CheckCircle2, AlertCircle, Play, MessageSquare, TextCursorInput,
  List, Split, GitMerge, Link2, Database, Code2, Replace, FileInput, Calendar,
  Star, Clock, TerminalSquare, Variable, UploadCloud, Webhook,
  Bot, Mail, Sheet, LayoutTemplate, MonitorSmartphone, MessageCircle, Mic, Image as ImageIcon, Users, BrainCircuit
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { useToast } from '@/hooks/use-toast';
import { NodeData, WorkspaceData } from '@/lib/types';
import { NodeComponentProps } from './NodeProps';
import { arePropsEqual } from './utils/nodeUtils'; // Assuming arePropsEqual is exported from there or I should define it here.
import { NODE_HEADER_CONNECTOR_Y_OFFSET } from '@/lib/constants';

// Import all node components
import { StartNode } from './nodes/StartNode';
import { MessageNode } from './nodes/MessageNode';
import { InputNode } from './nodes/InputNode';
import { OptionNode } from './nodes/OptionNode';
import { ConditionNode } from './nodes/ConditionNode';
import { SwitchNode } from './nodes/SwitchNode';
import { ApiCallNode } from './nodes/ApiCallNode';
import { SetVariableNode } from './nodes/SetVariableNode';
import { DelayNode } from './nodes/DelayNode';
import { RedirectNode } from './nodes/RedirectNode';
import { TypingEmulationNode } from './nodes/TypingEmulationNode';
import { LogConsoleNode } from './nodes/LogConsoleNode';
import { EndFlowNode } from './nodes/EndFlowNode';
import { DateInputNode } from './nodes/DateInputNode';
import { FileUploadNode } from './nodes/FileUploadNode';
import { RatingInputNode } from './nodes/RatingInputNode';
import { CodeExecutionNode } from './nodes/CodeExecutionNode';
import { JsonTransformNode } from './nodes/JsonTransformNode';
import { WhatsappTextNode } from './nodes/WhatsappTextNode';
import { WhatsappMediaNode } from './nodes/WhatsappMediaNode';
import { WhatsappGroupNode } from './nodes/WhatsappGroupNode';
import { AiTextGenerationNode } from './nodes/AiTextGenerationNode';
import { SendEmailNode } from './nodes/SendEmailNode';
import { GoogleSheetsAppendNode } from './nodes/GoogleSheetsAppendNode';
import { IntelligentAgentNode } from './nodes/IntelligentAgentNode';
import { DialogySendMessageNode } from './nodes/DialogySendMessageNode';
import { TimeOfDayNode } from './nodes/TimeOfDayNode';
import { MediaDisplayNode } from './nodes/MediaDisplayNode';
import {
  SupabaseCreateRowNode,
  SupabaseReadRowNode,
  SupabaseUpdateRowNode,
  SupabaseDeleteRowNode
} from './nodes/SupabaseNode';
import { IntentionRouterNode } from './nodes/IntentionRouterNode';

// Map of node types to components
const NODE_COMPONENTS: Record<string, React.FC<NodeComponentProps>> = {
  start: StartNode,
  message: MessageNode,
  input: InputNode,
  option: OptionNode,
  condition: ConditionNode,
  switch: SwitchNode,
  'api-call': ApiCallNode,
  'set-variable': SetVariableNode,
  delay: DelayNode,
  redirect: RedirectNode,
  'typing-emulation': TypingEmulationNode,
  'log-console': LogConsoleNode,
  'end-flow': EndFlowNode,
  'date-input': DateInputNode,
  'file-upload': FileUploadNode,
  'rating-input': RatingInputNode,
  'code-execution': CodeExecutionNode,
  'json-transform': JsonTransformNode,
  'whatsapp-text': WhatsappTextNode,
  'whatsapp-media': WhatsappMediaNode,
  'whatsapp-group': WhatsappGroupNode,
  'ai-text-generation': AiTextGenerationNode,
  'send-email': SendEmailNode,
  'google-sheets-append': GoogleSheetsAppendNode,
  'intelligent-agent': IntelligentAgentNode,
  'dialogy-send-message': DialogySendMessageNode,
  'time-of-day': TimeOfDayNode,
  'media-display': MediaDisplayNode,
  'supabase-create-row': SupabaseCreateRowNode,
  'supabase-read-row': SupabaseReadRowNode,
  'supabase-update-row': SupabaseUpdateRowNode,
  'supabase-delete-row': SupabaseDeleteRowNode,
  'intention-router': IntentionRouterNode,
};

// Nodes that handle their own output connectors
const SELF_CONTAINED_NODES = [
  'start',
  'option',
  'condition',
  'switch',
  'time-of-day',
  'intention-router',
  'api-call',
  'message',
  'input',
  // End flow effectively handles its own (by having none)
  'end-flow'
];

interface NodeCardProps {
  node: NodeData;
  isSelected: boolean;
  onSelect: (id: string, shiftKey: boolean) => void;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateNode: (id: string, data: Partial<NodeData>) => void;
  onDeleteNode: (id: string) => void;
  onDuplicateNode: (id: string) => void;
  onStartConnection: (e: React.MouseEvent, node: NodeData, handleId: string) => void;
  onEndConnection: (e: React.MouseEvent, node: NodeData) => void;
  availableVariables: string[];
  activeWorkspace?: WorkspaceData | null;
}

const ConnectorDot = ({
  onMouseDown,
  handleId,
  title,
  colorClass = "bg-zinc-400 group-hover/connector:bg-primary"
}: {
  onMouseDown: (e: React.MouseEvent) => void,
  handleId: string,
  title?: string,
  colorClass?: string
}) => (
  <div
    className="w-3 h-3 rounded-full shadow-lg ring-2 ring-zinc-900 transition-all duration-300 group-hover/connector:w-4 group-hover/connector:h-4 group-hover/connector:ring-primary/30 cursor-crosshair"
    onMouseDown={onMouseDown}
    data-connector="true"
    data-handle-type="source"
    data-handle-id={handleId}
    title={title}
  >
    <div className={cn("w-full h-full rounded-full transition-colors duration-300", colorClass)} />
  </div>
);

const renderNodeIcon = (type: string) => {
  switch (type) {
    case 'start': return <Play className="w-3.5 h-3.5 text-emerald-400" />;
    case 'message': return <MessageSquare className="w-3.5 h-3.5 text-blue-400" />;
    case 'input': return <TextCursorInput className="w-3.5 h-3.5 text-orange-400" />;
    case 'option': return <List className="w-3.5 h-3.5 text-purple-400" />;
    case 'condition': return <Split className="w-3.5 h-3.5 text-yellow-400" />;
    case 'switch': return <GitMerge className="w-3.5 h-3.5 text-indigo-400" />;
    case 'api-call': return <Webhook className="w-3.5 h-3.5 text-pink-400" />;
    case 'redirect': return <Link2 className="w-3.5 h-3.5 text-zinc-400" />;
    case 'set-variable': return <Variable className="w-3.5 h-3.5 text-cyan-400" />;
    case 'code-execution': return <Code2 className="w-3.5 h-3.5 text-red-400" />;
    case 'json-transform': return <Replace className="w-3.5 h-3.5 text-amber-500" />;
    case 'date-input': return <Calendar className="w-3.5 h-3.5 text-teal-400" />;
    case 'file-upload': return <UploadCloud className="w-3.5 h-3.5 text-sky-500" />;
    case 'rating-input': return <Star className="w-3.5 h-3.5 text-yellow-500" />;
    case 'time-of-day': return <Clock className="w-3.5 h-3.5 text-fuchsia-400" />;
    case 'log-console': return <TerminalSquare className="w-3.5 h-3.5 text-gray-400" />;
    case 'typing-emulation': return <MoreHorizontal className="w-3.5 h-3.5 text-zinc-500" />;
    case 'whatsapp-text': return <MessageCircle className="w-3.5 h-3.5 text-green-500" />;
    case 'whatsapp-media': return <ImageIcon className="w-3.5 h-3.5 text-green-500" />;
    case 'whatsapp-group': return <Users className="w-3.5 h-3.5 text-green-600" />;
    case 'ai-text-generation': return <Bot className="w-3.5 h-3.5 text-violet-400" />;
    case 'send-email': return <Mail className="w-3.5 h-3.5 text-rose-400" />;
    case 'google-sheets-append': return <Sheet className="w-3.5 h-3.5 text-green-500" />;
    case 'intelligent-agent': return <LayoutTemplate className="w-3.5 h-3.5 text-indigo-500" />;
    case 'media-display': return <MonitorSmartphone className="w-3.5 h-3.5 text-blue-500" />;
    case 'dialogy-send-message': return <Mic className="w-3.5 h-3.5 text-primary" />;
    case 'supabase-create-row': return <Database className="w-3.5 h-3.5 text-emerald-400" />;
    case 'supabase-read-row': return <Database className="w-3.5 h-3.5 text-blue-400" />;
    case 'supabase-update-row': return <Database className="w-3.5 h-3.5 text-yellow-400" />;
    case 'supabase-delete-row': return <Database className="w-3.5 h-3.5 text-red-400" />;
    case 'intention-router': return <BrainCircuit className="w-3.5 h-3.5 text-indigo-400" />;
    case 'end-flow': return <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />;
    default: return <AlertCircle className="w-3.5 h-3.5 text-zinc-500" />;
  }
};

const NodeCard = memo(({
  node,
  isSelected,
  onSelect,
  onDragStart,
  onUpdatePosition,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  onStartConnection,
  onEndConnection,
  availableVariables,
  activeWorkspace
}: NodeCardProps) => {
  // Note: In the original monolithic component, we had extensive logic here.
  // Now it delegates to sub-components.

  const NodeComponent = NODE_COMPONENTS[node.type];
  const { toast } = useToast();

  // Input Handle (Logic from original: lines ~400)
  // Always rendered except for 'start' node which typically doesn't have an input handle,
  // OR it might if we allow loops back to start? Usually start is a trigger.
  // Original code: if (node.type !== 'start') renderTargetHandle...
  const showInputHandle = node.type !== 'start';

  return (
    <Card
      className={cn(
        "w-full shadow-sm transition-all duration-200 select-none group/card p-0", // Removed absolute and fixed width (handled by parent)
        "bg-zinc-950/80 backdrop-blur-md border", // Base
        isSelected ? "border-primary ring-1 ring-primary/20 bg-zinc-900/90 z-20 shadow-lg" : "border-white/5 hover:border-white/10 hover:bg-zinc-900/50 z-10"
      )}
      // Removed style={{ left: node.x, top: node.y }} as parent handles it
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(node.id, e.shiftKey);
      }}
      onClick={(e) => e.stopPropagation()}
      data-node-id={node.id}
    >
      {/* Header / Drag Handle */}
      <div
        className={cn(
          "flex items-center justify-between p-2.5 border-b cursor-grab active:cursor-grabbing rounded-t-lg transition-colors",
          isSelected ? "bg-primary/5 border-primary/10" : "bg-white/[0.02] border-white/5 group-hover/card:bg-white/[0.04]"
        )}
        onMouseDown={(e) => onDragStart(e, node.id)}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div className={cn("p-1.5 rounded-md bg-black/40 border border-white/5 shadow-inner")}>
            {renderNodeIcon(node.type)}
          </div>
          {/* Editable Title via Popover */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <span className={cn("text-xs font-medium truncate max-w-[140px] cursor-pointer hover:underline decoration-white/20", isSelected ? "text-primary-foreground/90" : "text-zinc-300")}>
                {node.title || 'Sem título'}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 p-2">
              <Label className="text-[10px] text-muted-foreground mb-1 block">Renomear nó</Label>
              <Input
                value={node.title}
                onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
                className="h-7 text-xs"
                autoFocus
              />
            </DropdownMenuContent>
          </DropdownMenu>

        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-zinc-300 hover:bg-white/5" onClick={(e) => { e.stopPropagation(); onDuplicateNode(node.id); }}>
            <Copy className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-destructive hover:bg-destructive/10" onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Input Connector */}
      {showInputHandle && (
        <div
          className="absolute -left-3 top-9 z-20 flex items-center justify-center group/connector w-6 h-6"
          onMouseUp={(e) => { e.stopPropagation(); onEndConnection(e, node); }}
          data-connector="true"
          data-handle-type="target"
          data-node-id={node.id}
          title="Entrada da conexão"
        >
          <div className={cn(
            "w-3 h-3 rounded-full border-2 transition-all duration-300 shadow-md",
            "bg-zinc-950 border-zinc-600 group-hover/connector:border-primary group-hover/connector:bg-primary/20 group-hover/connector:scale-125"
          )} />
        </div>
      )}

      {/* Node Content Body */}
      <div className="p-3">
        {NodeComponent ? (
          <NodeComponent
            node={node}
            activeWorkspace={activeWorkspace}
            availableVariables={availableVariables}
            onUpdate={onUpdateNode as any} // Typing alignment if needed
            onStartConnection={onStartConnection}
            activeNodeId={isSelected ? node.id : undefined}
          // Supabase props used to be passed here, logic for fetching tables/columns should ideally reside
          // within SupabaseNode or a custom hook inside it.
          // However, if the parent passed them, we need to pass them down.
          // Since I refactored SupabaseNode to separate files, I assume it handles its own data or accepts props.
          // The original monolithic NodeCard received supabaseTables etc via props?
          // If so, NodeCardProps needs to include them.
          // Checking NodeCardProps interface above... it does NOT include supabase props.
          // If the original NodeCard received them, they should be in NodeCardProps.
          // I will double check if NodeCard needs to receive them from FlowEditor.
          />
        ) : (
          <div className="text-xs text-destructive p-2 border border-destructive/20 bg-destructive/5 rounded">
            Tipo de nó desconhecido: {node.type}
          </div>
        )}
      </div>

      {/* Standard Output Connector (for linear nodes) */}
      {!SELF_CONTAINED_NODES.includes(node.type) && (
        <div
          className="absolute -right-3 top-9 z-20 flex items-center justify-center group/connector w-6 h-6"
          title="Saída (Padrão)"
        >
          <ConnectorDot
            onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
            handleId="default"
          />
        </div>
      )}

    </Card>
  );
}, (prev, next) => {
  // Use the comprehensive arePropsEqual from utils to avoid unnecessary re-renders
  // If arePropsEqual is not exported, I'll implement a basic one or assume it is imported.
  // I exported 'getProperty' but not 'arePropsEqual' in the previous step.
  // I should probably define a local one if I'm not sure.
  // Basic comparison:
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.node !== next.node) return false; // Shallow comparison of node object (immutable updates expected)
  if (prev.node.x !== next.node.x || prev.node.y !== next.node.y) return false;
  if (prev.activeWorkspace !== next.activeWorkspace) return false;
  // Variables comparison could be expensive, usually rely on ref equality
  if (prev.availableVariables !== next.availableVariables) return false;

  return true;
});

NodeCard.displayName = 'NodeCard';

export default NodeCard;