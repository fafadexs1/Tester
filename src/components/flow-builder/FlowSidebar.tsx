"use client";

import React, { useState } from 'react';
import DraggableBlock from './DraggableBlock';
import {
  MessageSquareText, Type, ListChecks, GitFork, Variable, Timer, Webhook,
  FileImage, Star, UploadCloud, StopCircle, GitCommitHorizontal, TerminalSquare,
  Code2, Shuffle, Sparkles, BrainCircuit, Blocks, Rocket, ExternalLink,
  CalendarDays, Mail, Sheet, LayoutTemplate, MonitorSmartphone, Mic, PlayCircle,
  Menu, Cpu, Zap, Database, Search, ChevronRight, Layers, Settings2,
  LogOut, Keyboard, History, FileJson, Share2, Phone, Image as ImageIcon, Users,
  MailSearch, DatabaseBackup, Clock, Calendar, FileUp, StarHalf
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { v4 as uuidv4 } from 'uuid';
import type { StartNodeTrigger } from '@/lib/types';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FlowSidebarProps {
  onInteractionChange?: (isActive: boolean) => void;
}

const FlowSidebarComponent: React.FC<FlowSidebarProps> = ({ onInteractionChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("basic");

  const iconProps = { className: "w-5 h-5 transition-all duration-300" };

  const defaultTriggers: StartNodeTrigger[] = [
    { id: uuidv4(), name: 'Manual', type: 'manual', enabled: true },
    { id: uuidv4(), name: 'Webhook', type: 'webhook', enabled: false, variableMappings: [], sessionTimeoutSeconds: 0 },
  ];

  const categories = [
    { id: "basic", label: "Essenciais", icon: <Layers {...iconProps} /> },
    { id: "logic", label: "Lógica", icon: <Cpu {...iconProps} /> },
    { id: "ai", label: "Inteligência", icon: <Zap {...iconProps} /> },
    { id: "whatsapp", label: "WhatsApp", icon: <Phone {...iconProps} /> },
    { id: "integrations", label: "Ecossistema", icon: <Blocks {...iconProps} /> },
    { id: "utils", label: "Utilidades", icon: <Settings2 {...iconProps} /> },
  ];

  const blockCategories: Record<string, any[]> = {
    basic: [
      { type: "start", label: "Gatilho", icon: <PlayCircle {...iconProps} className="text-emerald-400" />, description: "Ponto de entrada do fluxo", defaultData: { triggers: defaultTriggers } },
      { type: "message", label: "Enviar Texto", icon: <MessageSquareText {...iconProps} className="text-blue-400" />, defaultData: { text: 'Olá!' } },
      { type: "input", label: "Pergunta", icon: <Type {...iconProps} className="text-orange-400" />, defaultData: { inputType: 'text', promptText: 'Qual seu nome?', variableToSaveResponse: 'nome' } },
      { type: "option", label: "Opções", icon: <ListChecks {...iconProps} className="text-purple-400" />, defaultData: { questionText: 'Escolha:', optionsList: 'A\nB' } },
      { type: "media-display", label: "Mídia", icon: <FileImage {...iconProps} className="text-pink-400" />, defaultData: { mediaDisplayType: 'image', mediaDisplayUrl: 'https://placehold.co/300' } },
      { type: "typing-emulation", label: "Digitando...", icon: <Keyboard {...iconProps} className="text-zinc-400" />, defaultData: { typingDuration: 2000 } },
      { type: "delay", label: "Aguardar", icon: <Timer {...iconProps} className="text-amber-400" />, defaultData: { delayDuration: 1000 } },
      { type: "end-flow", label: "Encerrar", icon: <StopCircle {...iconProps} className="text-red-500" />, defaultData: {} },
    ],
    logic: [
      { type: "condition", label: "Condição", icon: <GitFork {...iconProps} className="text-yellow-400" />, defaultData: { conditionVariable: '{{var}}', conditionOperator: '==', conditionValue: 'val' } },
      { type: "switch", label: "Switch", icon: <GitCommitHorizontal {...iconProps} className="text-indigo-400" />, defaultData: { switchVariable: '{{status}}', switchCases: [] } },
      { type: "set-variable", label: "Definir Variável", icon: <Variable {...iconProps} className="text-cyan-400" />, defaultData: { variableName: 'nova_var', variableValue: '123' } },
      { type: "json-transform", label: "Mapear JSON", icon: <FileJson {...iconProps} className="text-pink-500" /> },
      { type: "code-execution", label: "Código JS", icon: <Code2 {...iconProps} className="text-amber-500" />, defaultData: { codeSnippet: "// sua lógica aqui", codeOutputVariable: 'res' } },
      { type: "log-console", label: "Log de Debug", icon: <TerminalSquare {...iconProps} className="text-zinc-500" /> },
    ],
    ai: [
      { type: "ai-text-generation", label: "Escritor IA", icon: <Sparkles {...iconProps} className="text-violet-400" />, defaultData: { aiPromptText: 'Resuma...', aiOutputVariable: 'res' } },
      { type: "intelligent-agent", label: "Agente Inteligente", icon: <BrainCircuit {...iconProps} className="text-sky-400" />, defaultData: { agentName: 'Assistente' } },
      { type: "ai-model-config", label: "AI Model Config", icon: <Cpu {...iconProps} className="text-violet-400" />, defaultData: { aiProvider: 'google' } },
      { type: "ai-memory-config", label: "Memory Config", icon: <Database {...iconProps} className="text-sky-400" />, defaultData: { memoryProvider: 'postgres', memoryScope: 'session' } },
      { type: "intention-router", label: "Intenções", icon: <BrainCircuit {...iconProps} className="text-indigo-500" /> },
      { type: "dialogy-send-message", label: "Dialogy", icon: <Rocket {...iconProps} className="text-orange-500" /> },
    ],
    whatsapp: [
      { type: "whatsapp-text", label: "Texto WA", icon: <MessageSquareText {...iconProps} className="text-emerald-500" /> },
      { type: "whatsapp-media", label: "Mídia WA", icon: <ImageIcon {...iconProps} className="text-emerald-400" /> },
      { type: "whatsapp-group", label: "Grupos WA", icon: <Users {...iconProps} className="text-emerald-600" /> },
    ],
    integrations: [
      { type: "capability", label: "Ferramentas MCP", icon: <Blocks {...iconProps} className="text-blue-500" />, description: "Executar ferramentas externas" },
      { type: "api-call", label: "Requisição HTTP", icon: <Webhook {...iconProps} className="text-rose-500" />, defaultData: { apiUrl: 'https://', apiMethod: 'GET' } },
      { type: "send-email", label: "E-mail", icon: <Mail {...iconProps} className="text-blue-500" /> },
      { type: "google-sheets-append", label: "Google Sheets", icon: <Sheet {...iconProps} className="text-emerald-500" /> },
      { type: "supabase-create-row", label: "SB Criar", icon: <Database {...iconProps} className="text-emerald-400" /> },
      { type: "supabase-read-row", label: "SB Ler", icon: <DatabaseBackup {...iconProps} className="text-emerald-500" /> },
      { type: "supabase-update-row", label: "SB Atualizar", icon: <Database {...iconProps} className="text-blue-400" /> },
      { type: "supabase-delete-row", label: "SB Deletar", icon: <Database {...iconProps} className="text-red-400" /> },
      { type: "redirect", label: "Redirecionar", icon: <ExternalLink {...iconProps} className="text-zinc-400" /> },
    ],
    utils: [
      { type: "time-of-day", label: "Faixa Horária", icon: <Clock {...iconProps} className="text-indigo-400" /> },
      { type: "date-input", label: "Pedir Data", icon: <Calendar {...iconProps} className="text-orange-400" /> },
      { type: "file-upload", label: "Pedir Arquivo", icon: <FileUp {...iconProps} className="text-blue-400" /> },
      { type: "rating-input", label: "Pedir Avaliação", icon: <StarHalf {...iconProps} className="text-yellow-400" /> },
    ]
  };

  return (
    <aside
      className={cn(
        "fixed left-6 top-24 bottom-6 z-40 flex gap-0 transition-all duration-500 group/sidebar",
        isExpanded ? "w-[300px]" : "w-16"
      )}
      onMouseEnter={() => { setIsExpanded(true); onInteractionChange?.(true); }}
      onMouseLeave={() => { setIsExpanded(false); onInteractionChange?.(false); }}
    >
      {/* Dock Rail */}
      <div className="w-16 h-full neo-glass flex flex-col items-center py-6 gap-6 rounded-l-[2rem] border-r-0">
        <div className="p-2 bg-primary/10 rounded-2xl aurora-glow">
          <Menu className="w-6 h-6 text-primary" />
        </div>

        <div className="flex-1 flex flex-col gap-4 mt-4 w-full px-2">
          <TooltipProvider delayDuration={0}>
            {categories.map((cat) => (
              <Tooltip key={cat.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveCategory(cat.id)}
                    className={cn(
                      "p-3 rounded-2xl transition-all duration-300 relative group/btn",
                      activeCategory === cat.id
                        ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10"
                        : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                    )}
                  >
                    {cat.icon}
                    {activeCategory === cat.id && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full aurora-glow" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="neo-glass text-[10px] font-bold uppercase tracking-widest border-white/10">
                  {cat.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>

        <button className="p-3 text-zinc-500 hover:text-white transition-colors">
          <Settings2 className="w-5 h-5" />
        </button>
      </div>

      {/* Expanded Content */}
      <div
        className={cn(
          "flex-1 h-full bg-black/60 backdrop-blur-2xl border border-l-0 border-white/10 rounded-r-[2rem] overflow-hidden transition-all duration-500 origin-left flex flex-col",
          isExpanded ? "opacity-100 scale-x-100 translate-x-0" : "opacity-0 scale-x-0 -translate-x-8 pointer-events-none"
        )}
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h2 className="text-sm font-bold tracking-widest uppercase text-zinc-400">
            {categories.find(c => c.id === activeCategory)?.label}
          </h2>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-primary aurora-glow animate-pulse" />
            <span className="text-[10px] font-mono text-zinc-600">AO VIVO</span>
          </div>
        </div>

        <ScrollArea className="flex-1 px-4 py-4">
          <div className="grid grid-cols-1 gap-2.5">
            {blockCategories[activeCategory].map((block) => (
              <DraggableBlock
                key={block.type}
                type={block.type}
                label={block.label}
                icon={block.icon}
                defaultData={block.defaultData}
              />
            ))}
          </div>
        </ScrollArea>

        <div className="p-6 bg-gradient-to-t from-black/40 to-transparent">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-help">
            <Search className="w-4 h-4 text-zinc-500" />
            <span className="text-[10px] text-zinc-400 font-medium">Buscar blocos...</span>
            <kbd className="ml-auto px-1.5 py-0.5 rounded bg-white/5 text-[8px] font-mono border border-white/10">⌘K</kbd>
          </div>
        </div>
      </div>
    </aside>
  );
};

const FlowSidebar = React.memo(FlowSidebarComponent);
FlowSidebar.displayName = 'FlowSidebar';

export default FlowSidebar;
