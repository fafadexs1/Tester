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

export const NODE_COMPONENTS: Record<string, React.FC<NodeComponentProps>> = {
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
  onConfigure?: (id: string) => void;
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
    case 'ai-memory-config': return <Database className={cn(iconClass, "text-blue-400")} />;
    case 'ai-model-config': return <BrainCircuit className={cn(iconClass, "text-violet-400")} />;
    default: return <Command className={cn(iconClass, "text-zinc-500")} />;
  }
};

const NodeCard = memo(({
  node, isSelected, onSelect, onDragStart, onUpdateNode, onDeleteNode, onDuplicateNode, onStartConnection, onEndConnection, onConfigure, availableVariables, activeWorkspace
}: NodeCardProps) => {
  const NodeComponent = NODE_COMPONENTS[node.type];
  const showInputHandle = node.type !== 'start';

  // N8N-style sub-nodes that should be circular
  const SUB_NODE_TYPES = ['ai-memory-config', 'ai-model-config', 'capability'];
  const isSubNode = SUB_NODE_TYPES.includes(node.type);
  const isCompactSubNode = isSubNode; // Always compact/circular

  // Labels for sub-nodes
  const getSubNodeConfig = () => {
    switch (node.type) {
      case 'ai-memory-config':
        return { label: 'Memory', iconColor: 'text-blue-400', bgColor: 'from-blue-500/20 to-blue-600/10', borderColor: 'border-blue-500/30', glowColor: 'rgba(59,130,246,0.3)' };
      case 'ai-model-config':
        return { label: 'Model', iconColor: 'text-violet-400', bgColor: 'from-violet-500/20 to-violet-600/10', borderColor: 'border-violet-500/30', glowColor: 'rgba(139,92,246,0.3)' };
      case 'capability':
        return { label: node.capabilityName || 'Tool', iconColor: 'text-amber-400', bgColor: 'from-amber-500/20 to-amber-600/10', borderColor: 'border-amber-500/30', glowColor: 'rgba(245,158,11,0.3)' };
      default:
        return { label: 'Node', iconColor: 'text-zinc-400', bgColor: 'from-zinc-500/20 to-zinc-600/10', borderColor: 'border-zinc-500/30', glowColor: 'rgba(113,113,122,0.3)' };
    }
  };
  const subNodeConfig = getSubNodeConfig();

  return (
    <div
      className={cn(
        "relative w-full rounded-[2rem] transition-[transform,colors,box-shadow] duration-300 group/card will-change-transform",
        isCompactSubNode ? "bg-transparent shadow-none border-none" : "neo-glass border-white/[0.05]",
        isSelected
          ? (isCompactSubNode
            ? "z-30 scale-105" // For circular nodes, just scale up slightly and bring to front, NO borders/rectangles
            : "scale-[1.02] border-primary/40 ring-1 ring-primary/20 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] z-30")
          : "hover:border-white/10 hover:shadow-2xl z-20"
      )}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node.id, e.shiftKey); }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (isSubNode && onConfigure) {
          onConfigure(node.id);
        }
      }}
      data-node-id={node.id}
    >
      {/* Aurora Glow behind card - Disable for compact nodes */}
      {!isCompactSubNode && (
        <div className={cn(
          "absolute -inset-1 rounded-[2.5rem] opacity-0 blur-lg transition-opacity duration-300 -z-10 bg-primary/5 will-change-[opacity]",
          isSelected && "opacity-100"
        )} />
      )}

      {!isCompactSubNode && (
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
      {showInputHandle && !isCompactSubNode && (
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
      <div className={cn("p-5", isCompactSubNode && "pt-6 pb-6")}>
        {isCompactSubNode ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative w-28 h-28 flex items-center justify-center group/circle"
            >
              <div
                className={cn(
                  "absolute inset-0 rounded-full bg-gradient-to-br border shadow-2xl transition-transform duration-300 group-hover/circle:scale-105 cursor-crosshair",
                  subNodeConfig.bgColor,
                  subNodeConfig.borderColor
                )}
                style={{ boxShadow: `0 0 30px ${subNodeConfig.glowColor}` }}
                onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
                data-connector="true" data-handle-type="source" data-handle-id="default" data-node-id={node.id}
                title="Arraste para conectar"
              />

              <div
                className={cn(
                  "absolute inset-4 rounded-full bg-black/80 border flex items-center justify-center cursor-grab active:cursor-grabbing z-10 transition-colors",
                  subNodeConfig.borderColor
                )}
                onMouseDown={(e) => onDragStart(e, node.id)}
              >
                <div className={cn("transform scale-150", subNodeConfig.iconColor)}>
                  {renderNodeIcon(node.type)}
                </div>
              </div>

              {/* Explicit Top Source Handle for easy connection */}
              <div
                className={cn(
                  "absolute -top-1.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 bg-black z-50 cursor-crosshair transition-transform hover:scale-125",
                  subNodeConfig.borderColor
                )}
                style={{ boxShadow: `0 0 8px ${subNodeConfig.glowColor}` }}
                onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node, 'default'); }}
                data-connector="true" data-handle-type="source" data-handle-id="default" data-node-id={node.id}
                title="Arraste para conectar ao Agente"
              >
                <div className={cn("absolute inset-0.5 rounded-full opacity-50", subNodeConfig.bgColor)} />
              </div>

              {/* Delete Button - Visible on Hover */}
              <button
                className="absolute top-0 right-0 p-1.5 rounded-full bg-zinc-900 border border-zinc-700 text-zinc-400 hover:bg-red-500/20 hover:border-red-500 hover:text-red-500 transition-all opacity-0 group-hover/circle:opacity-100 z-50 transform hover:scale-110"
                onClick={(e) => { e.stopPropagation(); onDeleteNode(node.id); }}
                title="Deletar Nó"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>


            </div>

            <div className="text-center space-y-1 px-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-zinc-200">{subNodeConfig.label}</p>
              <p className="text-[9px] text-zinc-500 font-mono">{node.capabilityVersion ? `v${node.capabilityVersion}` : node.type}</p>
              {node.capabilityContract?.summary && (
                <p className="text-[9px] text-zinc-500 line-clamp-2">{node.capabilityContract.summary}</p>
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
      {!SELF_CONTAINED_NODES.includes(node.type) && !isCompactSubNode && (
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
