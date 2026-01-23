"use client";

import React, { memo } from 'react';
import { Card } from '@/components/ui/card';
import {
  MoreHorizontal, Copy, Trash2, CheckCircle2, AlertCircle, Play, MessageSquare, TextCursorInput,
  List, Split, GitMerge, Link2, Database, Code2, Replace, FileInput, Calendar,
  Star, Clock, TerminalSquare, Variable, UploadCloud, Webhook,
  Bot, Mail, Sheet, LayoutTemplate, MonitorSmartphone, MessageCircle, Mic, Image as ImageIcon, Users, BrainCircuit, Blocks, Sparkles, ChevronDown, Rocket, Command
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from "@/lib/utils";
import { NodeData, WorkspaceData } from '@/lib/types';
import { NodeComponentProps } from './NodeProps';

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
import { CapabilityNode } from './nodes/CapabilityNode';
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
  SupabaseCreateRowNode, SupabaseReadRowNode, SupabaseUpdateRowNode, SupabaseDeleteRowNode
} from './nodes/SupabaseNode';
import { IntentionRouterNode } from './nodes/IntentionRouterNode';
import { ModelNode } from './nodes/ModelNode';
import { MemoryNode } from './nodes/MemoryNode';

const NODE_COMPONENTS: Record<string, React.FC<NodeComponentProps>> = {
  start: StartNode, message: MessageNode, input: InputNode, option: OptionNode,
  condition: ConditionNode, switch: SwitchNode, 'api-call': ApiCallNode,
  'set-variable': SetVariableNode, delay: DelayNode, redirect: RedirectNode,
  'typing-emulation': TypingEmulationNode, 'log-console': LogConsoleNode,
  'end-flow': EndFlowNode, 'date-input': DateInputNode, 'file-upload': FileUploadNode,
  'rating-input': RatingInputNode, capability: CapabilityNode, 'code-execution': CodeExecutionNode,
  'json-transform': JsonTransformNode, 'whatsapp-text': WhatsappTextNode,
  'whatsapp-media': WhatsappMediaNode, 'whatsapp-group': WhatsappGroupNode,
  'ai-text-generation': AiTextGenerationNode, 'send-email': SendEmailNode,
  'google-sheets-append': GoogleSheetsAppendNode, 'intelligent-agent': IntelligentAgentNode,
  'dialogy-send-message': DialogySendMessageNode, 'time-of-day': TimeOfDayNode,
  'media-display': MediaDisplayNode, 'supabase-create-row': SupabaseCreateRowNode,
  'supabase-read-row': SupabaseReadRowNode, 'supabase-update-row': SupabaseUpdateRowNode,
  'supabase-delete-row': SupabaseDeleteRowNode, 'intention-router': IntentionRouterNode,
  'ai-model-config': ModelNode,
  'ai-memory-config': MemoryNode,
};

const SELF_CONTAINED_NODES = ['start', 'option', 'condition', 'switch', 'time-of-day', 'intention-router', 'api-call', 'message', 'input', 'end-flow'];

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

const renderNodeIcon = (type: string) => {
  const iconClass = "w-4 h-4";
  switch (type) {
    case 'start': return <Play className={cn(iconClass, "text-emerald-400")} />;
    case 'message': return <MessageSquare className={cn(iconClass, "text-blue-400")} />;
    case 'input': return <TextCursorInput className={cn(iconClass, "text-orange-400")} />;
    case 'option': return <List className={cn(iconClass, "text-purple-400")} />;
    case 'condition': return <Split className={cn(iconClass, "text-yellow-400")} />;
    case 'switch': return <GitMerge className={cn(iconClass, "text-indigo-400")} />;
    case 'ai-text-generation': return <Sparkles className={cn(iconClass, "text-violet-400")} />;
    case 'api-call': return <Webhook className={cn(iconClass, "text-pink-400")} />;
    case 'end-flow': return <CheckCircle2 className={cn(iconClass, "text-rose-500")} />;
    default: return <Command className={cn(iconClass, "text-zinc-500")} />;
  }
};

const NodeCard = memo(({
  node, isSelected, onSelect, onDragStart, onUpdateNode, onDeleteNode, onDuplicateNode, onStartConnection, onEndConnection, availableVariables, activeWorkspace
}: NodeCardProps) => {
  const NodeComponent = NODE_COMPONENTS[node.type];
  const showInputHandle = node.type !== 'start';
  const isToolNode = node.type === 'capability';
  const isCompactToolNode = isToolNode && !isSelected;
  const toolLabel = node.capabilityName || node.title || 'Tool';
  const toolSubLabel = node.capabilityVersion ? `v${node.capabilityVersion}` : 'MCP Tool';
  const toolSummary = node.capabilityContract?.summary || node.capabilityContract?.description || '';

  return (
    <div
      className={cn(
        "relative w-full rounded-[2rem] transition-[transform,colors,box-shadow] duration-300 group/card will-change-transform",
        "neo-glass border-white/[0.05]",
        isSelected
          ? "scale-[1.02] border-primary/40 ring-1 ring-primary/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] z-30"
          : "hover:border-white/10 hover:shadow-2xl z-20"
      )}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node.id, e.shiftKey); }}
      data-node-id={node.id}
    >
      {/* Aurora Glow behind card */}
      <div className={cn(
        "absolute -inset-1 rounded-[2.5rem] opacity-0 blur-lg transition-opacity duration-300 -z-10 bg-primary/5 will-change-[opacity]",
        isSelected && "opacity-100"
      )} />

      {!isCompactToolNode && (
        <div
          className={cn(
            "flex items-center justify-between p-4 cursor-grab active:cursor-grabbing rounded-t-[2rem] border-b border-white/[0.03] bg-white/[0.01]",
          )}
          onMouseDown={(e) => onDragStart(e, node.id)}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-black/40 border border-white/5 shadow-inner">
              {renderNodeIcon(node.type)}
            </div>
            <div className="flex flex-col">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center gap-1.5 cursor-pointer hover:text-white transition-colors group/title">
                    <span className="text-[11px] font-bold tracking-wider text-zinc-100 uppercase">{node.title || 'Untitled Node'}</span>
                    <ChevronDown className="w-3 h-3 text-zinc-600 group-hover/title:text-zinc-400" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="neo-glass border-white/10 p-2 min-w-[200px]">
                  <Label className="text-[9px] uppercase tracking-widest text-zinc-500 mb-2 block px-2">Rename Strategy</Label>
                  <Input
                    value={node.title}
                    onChange={(e) => onUpdateNode(node.id, { title: e.target.value })}
                    className="h-8 text-xs bg-black/50 border-white/5"
                    autoFocus
                  />
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-[9px] text-zinc-500 font-mono flex items-center gap-1">
                {node.type.toUpperCase()} <div className="w-1 h-1 rounded-full bg-zinc-700" /> ID: {node.id.substring(0, 4)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 opacity-0 group-hover/card:opacity-100 transition-all">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-zinc-500 hover:text-white" onClick={(e) => { e.stopPropagation(); onDuplicateNode(node.id); }}>
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10" onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Target Handle (Input) */}
      {showInputHandle && !isCompactToolNode && (
        <div
          className="absolute -left-2 top-11 z-30 flex items-center justify-center group/h-in w-4 h-4"
          onMouseUp={(e) => { e.stopPropagation(); onEndConnection(e, node); }}
          data-connector="true" data-handle-type="target" data-handle-id="default" data-node-id={node.id}
        >
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover/h-in:opacity-100 transition-opacity" />
          <div className="w-2 h-2 rounded-full border-2 border-primary bg-black group-hover/h-in:scale-125 transition-all" />
        </div>
      )}

      {/* Node Body */}
      <div className={cn("p-5", isCompactToolNode && "pt-6 pb-6")}>
        {isCompactToolNode ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative w-28 h-28 flex items-center justify-center"
            >
              <div
                className="absolute inset-0 rounded-full bg-gradient-to-br from-sky-500/20 via-transparent to-amber-400/20 border border-white/10 shadow-[0_0_24px_rgba(56,189,248,0.25)] cursor-crosshair"
                onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
                data-connector="true" data-handle-type="source" data-handle-id="default" data-node-id={node.id}
                title="Arraste para conectar"
              />
              <div className="absolute inset-1.5 rounded-full border border-dashed border-white/10 animate-[spin_12s_linear_infinite] pointer-events-none" />
              <div
                className="absolute inset-4 rounded-full bg-black/70 border border-white/10 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
                onMouseDown={(e) => onDragStart(e, node.id)}
              >
                <Blocks className="w-6 h-6 text-sky-300" />
              </div>

              {showInputHandle && (
                <div
                  className="absolute -left-3 top-1/2 -translate-y-1/2 z-30 flex items-center justify-center group/h-in w-4 h-4"
                  onMouseUp={(e) => { e.stopPropagation(); onEndConnection(e, node); }}
                  data-connector="true" data-handle-type="target" data-handle-id="default" data-node-id={node.id}
                >
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-md opacity-0 group-hover/h-in:opacity-100 transition-opacity" />
                  <div className="w-2 h-2 rounded-full border-2 border-primary bg-black group-hover/h-in:scale-125 transition-all" />
                </div>
              )}
            </div>

            <div className="text-center space-y-1 px-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-200">{toolLabel}</p>
              <p className="text-[9px] text-zinc-500 font-mono">{toolSubLabel}</p>
              {toolSummary && (
                <p className="text-[9px] text-zinc-500 line-clamp-2">{toolSummary}</p>
              )}
            </div>
          </div>
        ) : NodeComponent ? (
          <NodeComponent
            node={node} activeWorkspace={activeWorkspace} availableVariables={availableVariables}
            onUpdate={onUpdateNode as any} onStartConnection={onStartConnection}
            onEndConnection={(e: React.MouseEvent, n: NodeData, hId?: string) => onEndConnection(e, n)}
            activeNodeId={isSelected ? node.id : undefined}
          />
        ) : (
          <div className="text-[10px] text-red-400 p-3 bg-red-400/5 border border-red-400/10 rounded-2xl italic">
            Component failure: {node.type}
          </div>
        )}
      </div>

      {/* Source Handle (Output) */}
      {!SELF_CONTAINED_NODES.includes(node.type) && !isCompactToolNode && (
        <div
          className="absolute -right-2 top-11 z-30 flex items-center justify-center group/h-out w-4 h-4 cursor-crosshair"
          onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
          data-connector="true" data-handle-type="source" data-handle-id="default" data-node-id={node.id}
        >
          <div className="absolute inset-0 bg-primary/40 rounded-full blur-lg opacity-0 group-hover/h-out:opacity-100 transition-opacity" />
          <div className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-black group-hover/h-out:scale-150 transition-all shadow-[0_0_10px_rgba(139,92,246,0.5)]" />
        </div>
      )}
    </div>
  );
}, (prev, next) => {
  return prev.isSelected === next.isSelected &&
    prev.node === next.node &&
    prev.availableVariables === next.availableVariables;
});

NodeCard.displayName = 'NodeCard';
export default NodeCard;
