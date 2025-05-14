
"use client";

import React, { useState } from 'react'; // Adicionado useState
import { useRef, useCallback } from 'react';
import type { NodeData } from '@/lib/types';
import { motion } from 'framer-motion';
import {
  MessageSquareText, Type as InputIcon, ListChecks, Trash2, BotMessageSquare,
  ImageUp, UserPlus2, GitFork, Variable, Webhook, Timer, Settings2,
  CalendarDays, ExternalLink, MoreHorizontal, FileImage,
  TerminalSquare, Code2, Shuffle, UploadCloud, Star, Sparkles, Mail, Sheet, BrainCircuit, Headset, Hash,
  Database, Rows, Search, Edit3, PlayCircle, PlusCircle 
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { START_NODE_TRIGGER_INITIAL_Y_OFFSET, START_NODE_TRIGGER_SPACING_Y, OPTION_NODE_HANDLE_INITIAL_Y_OFFSET, OPTION_NODE_HANDLE_SPACING_Y } from '@/lib/constants';


interface NodeCardProps {
  node: NodeData;
  onUpdate: (id: string, changes: Partial<NodeData>) => void;
  onStartConnection: (event: React.MouseEvent, fromId: string, sourceHandleId?: string) => void;
  onDeleteNode: (id: string) => void;
}

const NodeCard: React.FC<NodeCardProps> = React.memo(({ node, onUpdate, onStartConnection, onDeleteNode }) => {
  const isDraggingNode = useRef(false);
  const [newTriggerName, setNewTriggerName] = useState('');

  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
        target.dataset.connector === 'true' || 
        target.closest('[data-action="delete-node"]') ||
        target.closest('input, textarea, select, button:not([data-drag-handle="true"])') && !target.closest('div[data-drag-handle="true"]')?.contains(target)
    ) {
      return;
    }
    
    isDraggingNode.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const initialModelX = node.x;
    const initialModelY = node.y;

    const handleNodeMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingNode.current) return;
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      onUpdate(node.id, { x: initialModelX + dx, y: initialModelY + dy });
    };

    const handleNodeMouseUp = () => {
      isDraggingNode.current = false;
      document.removeEventListener('mousemove', handleNodeMouseMove);
      document.removeEventListener('mouseup', handleNodeMouseUp);
    };

    document.addEventListener('mousemove', handleNodeMouseMove);
    document.addEventListener('mouseup', handleNodeMouseUp);
  }, [node.x, node.y, node.id, onUpdate]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); 
    onDeleteNode(node.id);
  }, [node.id, onDeleteNode]);

  const handleAddTrigger = () => {
    if (newTriggerName.trim() === '') return;
    const currentTriggers = node.triggers || [];
    if (currentTriggers.includes(newTriggerName.trim())) {
        console.warn("Nome do gatilho já existe.");
        return;
    }
    onUpdate(node.id, { triggers: [...currentTriggers, newTriggerName.trim()] });
    setNewTriggerName('');
  };

  const handleRemoveTrigger = (indexToRemove: number) => {
    const currentTriggers = node.triggers || [];
    onUpdate(node.id, { triggers: currentTriggers.filter((_, index) => index !== indexToRemove) });
  };

  const handleTriggerNameChange = (indexToChange: number, newName: string) => {
    const currentTriggers = [...(node.triggers || [])];
    currentTriggers[indexToChange] = newName;
    onUpdate(node.id, { triggers: currentTriggers });
  };


  const renderNodeIcon = () => {
    const iconProps = { className: "w-5 h-5" };
    const icons: Record<NodeData['type'] | 'default', React.ReactNode> = {
      'start': <PlayCircle {...iconProps} color="hsl(var(--primary))" />,
      'message': <MessageSquareText {...iconProps} color="hsl(var(--accent))" />,
      'input': <InputIcon {...iconProps} className="text-green-500" />,
      'option': <ListChecks {...iconProps} className="text-purple-500" />,
      'whatsapp-text': <BotMessageSquare {...iconProps} className="text-teal-500" />,
      'whatsapp-media': <ImageUp {...iconProps} className="text-indigo-500" />,
      'whatsapp-group': <UserPlus2 {...iconProps} className="text-pink-500" />,
      'condition': <GitFork {...iconProps} className="text-orange-500" />,
      'set-variable': <Variable {...iconProps} className="text-cyan-500" />,
      'api-call': <Webhook {...iconProps} className="text-red-500" />,
      'delay': <Timer {...iconProps} className="text-yellow-500" />,
      'date-input': <CalendarDays {...iconProps} className="text-sky-500" />,
      'redirect': <ExternalLink {...iconProps} className="text-lime-500" />,
      'typing-emulation': <MoreHorizontal {...iconProps} className="text-gray-500" />,
      'media-display': <FileImage {...iconProps} className="text-blue-500" />,
      'log-console': <TerminalSquare {...iconProps} className="text-slate-500" />,
      'code-execution': <Code2 {...iconProps} className="text-amber-500" />,
      'json-transform': <Shuffle {...iconProps} className="text-violet-500" />,
      'file-upload': <UploadCloud {...iconProps} className="text-fuchsia-500" />,
      'rating-input': <Star {...iconProps} className="text-yellow-400" />,
      'ai-text-generation': <Sparkles {...iconProps} className="text-rose-500" />,
      'send-email': <Mail {...iconProps} className="text-blue-600" />,
      'google-sheets-append': <Sheet {...iconProps} className="text-emerald-500" />,
      'intelligent-agent': <Headset {...iconProps} className="text-sky-500" />,
      'supabase-create-row': <Rows {...iconProps} className="text-green-500" />,
      'supabase-read-row': <Search {...iconProps} className="text-blue-500" />,
      'supabase-update-row': <Edit3 {...iconProps} className="text-yellow-500" />,
      'supabase-delete-row': <Trash2 {...iconProps} className="text-red-500" />, 
      default: <Settings2 {...iconProps} className="text-gray-500" />,
    };
    return icons[node.type] || icons.default;
  };
  
  const renderOutputConnectors = () => {
    if (node.type === 'start') {
      return (node.triggers || []).map((triggerName, index) => (
        <div
          key={`trigger-${node.id}-${triggerName}-${index}`} 
          className="absolute -right-2.5 z-10 flex items-center"
          style={{ top: `${START_NODE_TRIGGER_INITIAL_Y_OFFSET + index * START_NODE_TRIGGER_SPACING_Y - 10}px` }} 
          title={`Gatilho: ${triggerName}`}
        >
          <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{triggerName}</span>
          <div
            className="w-5 h-5 bg-accent hover:opacity-80 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
            onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node.id, triggerName); }}
            data-connector="true"
            data-handle-type="source"
            data-handle-id={triggerName}
          >
            <Hash className="w-3 h-3 text-accent-foreground" />
          </div>
        </div>
      ));
    }
    if (node.type === 'option') {
      const options = (node.optionsList || '').split('\n').map(opt => opt.trim()).filter(opt => opt !== '');
      return options.map((optionText, index) => (
        <div
          key={`option-${node.id}-${optionText}-${index}`}
          className="absolute -right-2.5 z-10 flex items-center"
          style={{ top: `${OPTION_NODE_HANDLE_INITIAL_Y_OFFSET + index * OPTION_NODE_HANDLE_SPACING_Y - 10}px` }}
          title={`Opção: ${optionText}`}
        >
          <span className="text-xs text-muted-foreground mr-2 whitespace-nowrap overflow-hidden text-ellipsis max-w-[100px]">{optionText}</span>
          <div
            className="w-5 h-5 bg-accent hover:opacity-80 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
            onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node.id, optionText); }}
            data-connector="true"
            data-handle-type="source"
            data-handle-id={optionText}
          >
            <Hash className="w-3 h-3 text-accent-foreground" />
          </div>
        </div>
      ));
    }
    if (node.type === 'condition') {
      return (
        <>
          <div className="absolute -right-2.5 top-1/3 -translate-y-1/2 z-10">
            <div
              title="Saída Verdadeiro"
              className="w-5 h-5 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node.id, 'true'); }}
              data-connector="true" data-handle-type="source" data-handle-id="true"
            >
              <span className="text-xs text-white select-none">V</span>
            </div>
          </div>
          <div className="absolute -right-2.5 top-2/3 -translate-y-1/2 z-10">
            <div
              title="Saída Falso"
              className="w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node.id, 'false'); }}
              data-connector="true" data-handle-type="source" data-handle-id="false"
            >
              <span className="text-xs text-white select-none">F</span>
            </div>
          </div>
        </>
      );
    }
    // Para todos os outros tipos de nós que não sejam 'start', 'option', ou 'condition'
    return (
      <div className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-10">
        <div
          className="w-5 h-5 bg-accent hover:opacity-80 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
          onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node.id, 'default'); }}
          data-connector="true" data-handle-type="source" data-handle-id="default"
          title="Arraste para conectar"
        >
          <Hash className="w-3 h-3 text-accent-foreground" />
        </div>
      </div>
    );
  };

  const renderWhatsAppToggle = () => {
    if (node.type !== 'message' && node.type !== 'media-display') {
      return null;
    }
    return (
      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center space-x-2 mb-2">
          <Switch
            id={`${node.id}-sendViaWhatsApp`}
            checked={node.sendViaWhatsApp || false}
            onCheckedChange={(checked) => onUpdate(node.id, { sendViaWhatsApp: checked })}
            aria-label="Enviar via WhatsApp"
          />
          <Label htmlFor={`${node.id}-sendViaWhatsApp`} className="flex items-center cursor-pointer">
            <BotMessageSquare className="w-4 h-4 mr-2 text-green-600" />
            Enviar via WhatsApp
          </Label>
        </div>
        {node.sendViaWhatsApp && (
          <div className="space-y-2 pl-2 ml-4 border-l-2 border-green-500 animate-in fade-in-0 slide-in-from-top-2 duration-200">
            <div className="mt-2">
              <Label htmlFor={`${node.id}-whatsappInstanceName`}>Nome da Instância WhatsApp</Label>
              <Input 
                id={`${node.id}-whatsappInstanceName`} 
                placeholder="evolution_instance" 
                value={node.instanceName || 'evolution_instance'} 
                onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} 
              />
            </div>
            <div>
              <Label htmlFor={`${node.id}-whatsappTargetPhone`}>Telefone Destino (WhatsApp)</Label>
              <Input 
                id={`${node.id}-whatsappTargetPhone`} 
                placeholder="55119xxxxxxxx" 
                value={node.whatsappTargetPhoneNumber || ''} 
                onChange={(e) => onUpdate(node.id, { whatsappTargetPhoneNumber: e.target.value })} 
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const exampleSupabaseTables = ["clientes", "produtos", "pedidos", "usuarios"];
  const exampleSupabaseColumns = ["id", "uuid", "email", "nome", "created_at", "status", "preco", "user_id"];


  const renderNodeContent = () => {
    switch (node.type) {
      case 'start':
        return (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Gatilhos de Início</Label>
            {(node.triggers || []).map((trigger, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  type="text"
                  value={trigger}
                  onChange={(e) => handleTriggerNameChange(index, e.target.value)}
                  placeholder={`Nome do Gatilho ${index + 1}`}
                  className="flex-grow"
                />
                <Button variant="ghost" size="icon" onClick={() => handleRemoveTrigger(index)} className="text-destructive hover:text-destructive/80 w-8 h-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center space-x-2 pt-2">
              <Input
                type="text"
                value={newTriggerName}
                onChange={(e) => setNewTriggerName(e.target.value)}
                placeholder="Novo nome de gatilho"
                className="flex-grow"
                onKeyDown={(e) => e.key === 'Enter' && handleAddTrigger()}
              />
              <Button onClick={handleAddTrigger} size="sm" variant="outline">
                <PlusCircle className="w-4 h-4 mr-1" /> Adicionar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground italic pt-1">Cada gatilho pode iniciar um caminho diferente no fluxo.</p>
          </div>
        );
      case 'message':
        return (
          <>
            <Textarea placeholder="Mensagem do bot..." value={node.text || ''} onChange={(e) => onUpdate(node.id, { text: e.target.value })} className="resize-none text-sm" rows={3} />
            {renderWhatsAppToggle()}
          </>
        );
      case 'input':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-prompttext`}>Texto da Pergunta</Label><Textarea id={`${node.id}-prompttext`} placeholder="Digite sua pergunta aqui..." value={node.promptText || ''} onChange={(e) => onUpdate(node.id, { promptText: e.target.value })} rows={2}/></div>
            <div><Label htmlFor={`${node.id}-inputtype`}>Tipo de Entrada</Label>
              <Select value={node.inputType || 'text'} onValueChange={(value) => onUpdate(node.id, { inputType: value as NodeData['inputType'] })}>
                <SelectTrigger id={`${node.id}-inputtype`}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem><SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem><SelectItem value="number">Número</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-varsave`}>Salvar Resposta na Variável</Label><Input id={`${node.id}-varsave`} placeholder="nome_da_variavel" value={node.variableToSaveResponse || ''} onChange={(e) => onUpdate(node.id, { variableToSaveResponse: e.target.value })} /></div>
          </div>
        );
      case 'option':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-optionqtext`}>Texto da Pergunta</Label><Textarea id={`${node.id}-optionqtext`} placeholder="Qual sua escolha?" value={node.questionText || ''} onChange={(e) => onUpdate(node.id, { questionText: e.target.value })} rows={2}/></div>
            <div><Label htmlFor={`${node.id}-optionslist`}>Opções (uma por linha)</Label><Textarea id={`${node.id}-optionslist`} placeholder="Opção 1\nOpção 2" value={node.optionsList || ''} onChange={(e) => onUpdate(node.id, { optionsList: e.target.value })} rows={3}/></div>
            <div><Label htmlFor={`${node.id}-varsavechoice`}>Salvar Escolha na Variável (opcional)</Label><Input id={`${node.id}-varsavechoice`} placeholder="variavel_escolha" value={node.variableToSaveChoice || ''} onChange={(e) => onUpdate(node.id, { variableToSaveChoice: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground italic pt-1">Cada opção na lista acima terá um conector de saída dedicado.</p>
          </div>
        );
      case 'whatsapp-text':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-instance`}>Instância</Label><Input id={`${node.id}-instance`} placeholder="evolution_instance" value={node.instanceName || 'evolution_instance'} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-phone`}>Telefone</Label><Input id={`${node.id}-phone`} placeholder="55119..." value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-watext`}>Mensagem</Label><Textarea id={`${node.id}-watext`} value={node.textMessage || ''} onChange={(e) => onUpdate(node.id, { textMessage: e.target.value })} rows={2}/></div>
          </div>
        );
      case 'whatsapp-media':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-instance`}>Instância</Label><Input id={`${node.id}-instance`} placeholder="evolution_instance" value={node.instanceName || 'evolution_instance'} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-phone`}>Telefone</Label><Input id={`${node.id}-phone`} placeholder="55119..." value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-mediaurl`}>URL da Mídia</Label><Input id={`${node.id}-mediaurl`} placeholder="https://..." value={node.mediaUrl || ''} onChange={(e) => onUpdate(node.id, { mediaUrl: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-mediatype`}>Tipo</Label>
              <Select value={node.mediaType || 'image'} onValueChange={(value) => onUpdate(node.id, { mediaType: value as NodeData['mediaType'] })}>
                <SelectTrigger id={`${node.id}-mediatype`}><SelectValue placeholder="Selecione o tipo de mídia" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Imagem</SelectItem><SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="document">Documento</SelectItem><SelectItem value="audio">Áudio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-caption`}>Legenda</Label><Input id={`${node.id}-caption`} value={node.caption || ''} onChange={(e) => onUpdate(node.id, { caption: e.target.value })}/></div>
          </div>
        );
      case 'whatsapp-group':
         return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-instance`}>Instância</Label><Input id={`${node.id}-instance`} placeholder="evolution_instance" value={node.instanceName || 'evolution_instance'} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-groupname`}>Nome do Grupo</Label><Input id={`${node.id}-groupname`} value={node.groupName || ''} onChange={(e) => onUpdate(node.id, { groupName: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-participants`}>Participantes (separados por vírgula)</Label><Textarea id={`${node.id}-participants`} value={node.participants || ''} onChange={(e) => onUpdate(node.id, { participants: e.target.value })} rows={2}/></div>
          </div>
        );
      case 'condition':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-condvar`}>Variável</Label><Input id={`${node.id}-condvar`} placeholder="{{variavel}}" value={node.conditionVariable || ''} onChange={(e) => onUpdate(node.id, { conditionVariable: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-condop`}>Operador</Label>
              <Select value={node.conditionOperator || '=='} onValueChange={(value) => onUpdate(node.id, { conditionOperator: value as NodeData['conditionOperator']})}>
                <SelectTrigger id={`${node.id}-condop`}><SelectValue placeholder="Selecione o operador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="==">Igual a</SelectItem><SelectItem value="!=">Diferente de</SelectItem>
                  <SelectItem value=">">Maior que</SelectItem><SelectItem value="<">Menor que</SelectItem>
                  <SelectItem value="contains">Contém</SelectItem><SelectItem value="startsWith">Começa com</SelectItem>
                  <SelectItem value="endsWith">Termina com</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-condval`}>Valor</Label><Input id={`${node.id}-condval`} placeholder="Valor para comparar" value={node.conditionValue || ''} onChange={(e) => onUpdate(node.id, { conditionValue: e.target.value })}/></div>
          </div>
        );
      case 'set-variable':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-varname`}>Nome da Variável</Label><Input id={`${node.id}-varname`} placeholder="minhaVariavel" value={node.variableName || ''} onChange={(e) => onUpdate(node.id, { variableName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-varval`}>Valor</Label><Input id={`${node.id}-varval`} placeholder="Valor ou {{outra_var}}" value={node.variableValue || ''} onChange={(e) => onUpdate(node.id, { variableValue: e.target.value })}/></div>
          </div>
        );
      case 'api-call':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-apiurl`}>URL</Label><Input id={`${node.id}-apiurl`} placeholder="https://api.example.com/data" value={node.apiUrl || ''} onChange={(e) => onUpdate(node.id, { apiUrl: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-apimethod`}>Método</Label>
              <Select value={node.apiMethod || 'GET'} onValueChange={(value) => onUpdate(node.id, { apiMethod: value as NodeData['apiMethod']})}>
                <SelectTrigger id={`${node.id}-apimethod`}><SelectValue placeholder="Selecione o método" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-apiheaders`}>Cabeçalhos (JSON)</Label><Textarea id={`${node.id}-apiheaders`} placeholder='{ "Authorization": "Bearer ..." }' value={node.apiHeaders || ''} onChange={(e) => onUpdate(node.id, { apiHeaders: e.target.value })} rows={2}/></div>
            <div><Label htmlFor={`${node.id}-apibody`}>Corpo (JSON)</Label><Textarea id={`${node.id}-apibody`} placeholder='{ "key": "value" }' value={node.apiBody || ''} onChange={(e) => onUpdate(node.id, { apiBody: e.target.value })} rows={2}/></div>
          </div>
        );
      case 'delay':
        return (
          <div>
            <Label htmlFor={`${node.id}-delay`}>Duração (ms)</Label>
            <Input id={`${node.id}-delay`} type="number" placeholder="1000" value={node.delayDuration ?? ''} onChange={(e) => onUpdate(node.id, { delayDuration: parseInt(e.target.value, 10) || 0 })} />
          </div>
        );
      case 'date-input':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-datelabel`}>Texto da Pergunta</Label><Input id={`${node.id}-datelabel`} placeholder="Ex: Qual sua data de nascimento?" value={node.dateInputLabel || ''} onChange={(e) => onUpdate(node.id, {dateInputLabel: e.target.value})} /></div>
            <div><Label htmlFor={`${node.id}-varsavedate`}>Salvar Data na Variável</Label><Input id={`${node.id}-varsavedate`} placeholder="data_nascimento" value={node.variableToSaveDate || ''} onChange={(e) => onUpdate(node.id, { variableToSaveDate: e.target.value })} /></div>
          </div>
        );
      case 'redirect':
        return (
          <div>
            <Label htmlFor={`${node.id}-redirecturl`}>URL para Redirecionamento</Label>
            <Input id={`${node.id}-redirecturl`} placeholder="https://exemplo.com" value={node.redirectUrl || ''} onChange={(e) => onUpdate(node.id, { redirectUrl: e.target.value })} />
          </div>
        );
      case 'typing-emulation':
        return (
          <div>
            <Label htmlFor={`${node.id}-typingduration`}>Duração da Simulação (ms)</Label>
            <Input id={`${node.id}-typingduration`} type="number" placeholder="1500" value={node.typingDuration ?? ''} onChange={(e) => onUpdate(node.id, { typingDuration: parseInt(e.target.value, 10) || 0 })} />
          </div>
        );
      case 'media-display':
        return (
          <>
            <div className="space-y-3">
              <div><Label htmlFor={`${node.id}-mediadisplaytype`}>Tipo de Mídia</Label>
                <Select value={node.mediaDisplayType || 'image'} onValueChange={(value) => onUpdate(node.id, { mediaDisplayType: value as NodeData['mediaDisplayType'] })}>
                  <SelectTrigger id={`${node.id}-mediadisplaytype`}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image">Imagem</SelectItem>
                    <SelectItem value="video">Vídeo</SelectItem>
                    <SelectItem value="audio">Áudio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label htmlFor={`${node.id}-mediadisplayurl`}>URL da Mídia</Label><Input id={`${node.id}-mediadisplayurl`} placeholder="https://..." value={node.mediaDisplayUrl || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayUrl: e.target.value })} /></div>
              <div><Label htmlFor={`${node.id}-mediadisplaytext`}>Texto Alternativo/Legenda</Label><Input id={`${node.id}-mediadisplaytext`} placeholder="Descrição da mídia" value={node.mediaDisplayText || ''} onChange={(e) => onUpdate(node.id, { mediaDisplayText: e.target.value })} /></div>
            </div>
            {renderWhatsAppToggle()}
          </>
        );
      case 'log-console':
        return (
          <div>
            <Label htmlFor={`${node.id}-logmsg`}>Mensagem para Log (use {"{{variavel}}"} para variáveis)</Label>
            <Textarea id={`${node.id}-logmsg`} placeholder="Ex: Status: {{input.status}}" value={node.logMessage || ''} onChange={(e) => onUpdate(node.id, { logMessage: e.target.value })} rows={2}/>
          </div>
        );
      case 'code-execution':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-codesnippet`}>Trecho de Código (JavaScript)</Label><Textarea id={`${node.id}-codesnippet`} placeholder="return { resultado: 1 + 1 };" value={node.codeSnippet || ''} onChange={(e) => onUpdate(node.id, { codeSnippet: e.target.value })} rows={4}/></div>
            <div><Label htmlFor={`${node.id}-codeoutputvar`}>Salvar Saída na Variável</Label><Input id={`${node.id}-codeoutputvar`} placeholder="resultado_codigo" value={node.codeOutputVariable || ''} onChange={(e) => onUpdate(node.id, { codeOutputVariable: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Nota: O código é executado no servidor.</p>
          </div>
        );
      case 'json-transform':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-inputjson`}>JSON de Entrada (ou variável {"{{nome_variavel}}"})</Label><Textarea id={`${node.id}-inputjson`} placeholder='{ "chave": "valor" } ou {{dados_api}}' value={node.inputJson || ''} onChange={(e) => onUpdate(node.id, { inputJson: e.target.value })} rows={3}/></div>
            <div><Label htmlFor={`${node.id}-jsonata`}>Expressão JSONata</Label><Input id={`${node.id}-jsonata`} placeholder="$.chave" value={node.jsonataExpression || ''} onChange={(e) => onUpdate(node.id, { jsonataExpression: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-jsonoutputvar`}>Salvar JSON Transformado na Variável</Label><Input id={`${node.id}-jsonoutputvar`} placeholder="json_transformado" value={node.jsonOutputVariable || ''} onChange={(e) => onUpdate(node.id, { jsonOutputVariable: e.target.value })} /></div>
          </div>
        );
      case 'file-upload':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-uploadprompt`}>Texto do Prompt de Upload</Label><Input id={`${node.id}-uploadprompt`} placeholder="Por favor, envie seu documento." value={node.uploadPromptText || ''} onChange={(e) => onUpdate(node.id, { uploadPromptText: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-filefilter`}>Filtro de Tipo de Arquivo</Label><Input id={`${node.id}-filefilter`} placeholder="image/*, .pdf, .docx" value={node.fileTypeFilter || ''} onChange={(e) => onUpdate(node.id, { fileTypeFilter: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-maxsize`}>Tam. Máx. Arquivo (MB)</Label><Input id={`${node.id}-maxsize`} type="number" placeholder="5" value={node.maxFileSizeMB ?? ''} onChange={(e) => onUpdate(node.id, { maxFileSizeMB: parseInt(e.target.value, 10) || undefined })} /></div>
            <div><Label htmlFor={`${node.id}-fileurlvar`}>Salvar URL do Arquivo na Variável</Label><Input id={`${node.id}-fileurlvar`} placeholder="url_do_arquivo" value={node.fileUrlVariable || ''} onChange={(e) => onUpdate(node.id, { fileUrlVariable: e.target.value })} /></div>
          </div>
        );
      case 'rating-input':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-ratingq`}>Pergunta da Avaliação</Label><Input id={`${node.id}-ratingq`} placeholder="Como você nos avalia?" value={node.ratingQuestionText || ''} onChange={(e) => onUpdate(node.id, { ratingQuestionText: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-maxrating`}>Avaliação Máxima</Label><Input id={`${node.id}-maxrating`} type="number" placeholder="5" value={node.maxRatingValue ?? ''} onChange={(e) => onUpdate(node.id, { maxRatingValue: parseInt(e.target.value, 10) || 5 })} /></div>
            <div><Label htmlFor={`${node.id}-ratingicon`}>Ícone de Avaliação</Label>
              <Select value={node.ratingIconType || 'star'} onValueChange={(value) => onUpdate(node.id, { ratingIconType: value as NodeData['ratingIconType'] })}>
                <SelectTrigger id={`${node.id}-ratingicon`}><SelectValue placeholder="Selecione o ícone" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="star">Estrela</SelectItem><SelectItem value="heart">Coração</SelectItem><SelectItem value="number">Número</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-ratingoutputvar`}>Salvar Avaliação na Variável</Label><Input id={`${node.id}-ratingoutputvar`} placeholder="avaliacao_usuario" value={node.ratingOutputVariable || ''} onChange={(e) => onUpdate(node.id, { ratingOutputVariable: e.target.value })} /></div>
          </div>
        );
      case 'ai-text-generation':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-aiprompt`}>Prompt para IA (use {"{{variavel}}"} para variáveis)</Label><Textarea id={`${node.id}-aiprompt`} placeholder="Gere uma descrição para um produto chamado {{input.nome_produto}}." value={node.aiPromptText || ''} onChange={(e) => onUpdate(node.id, { aiPromptText: e.target.value })} rows={4}/></div>
            <div><Label htmlFor={`${node.id}-aimodel`}>Modelo de IA (opcional)</Label><Input id={`${node.id}-aimodel`} placeholder="gemini-2.0-flash (padrão)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-aioutputvar`}>Salvar Resposta da IA na Variável</Label><Input id={`${node.id}-aioutputvar`} placeholder="resposta_ia" value={node.aiOutputVariable || ''} onChange={(e) => onUpdate(node.id, { aiOutputVariable: e.target.value })} /></div>
          </div>
        );
      case 'send-email':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-emailto`}>Para (E-mail)</Label><Input id={`${node.id}-emailto`} type="email" placeholder="destinatario@exemplo.com" value={node.emailTo || ''} onChange={(e) => onUpdate(node.id, { emailTo: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-emailsubject`}>Assunto</Label><Input id={`${node.id}-emailsubject`} placeholder="Assunto do seu e-mail" value={node.emailSubject || ''} onChange={(e) => onUpdate(node.id, { emailSubject: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-emailbody`}>Corpo do E-mail (HTML ou Texto Simples)</Label><Textarea id={`${node.id}-emailbody`} placeholder="Olá {{input.nome_cliente}},\n\nSua mensagem aqui." value={node.emailBody || ''} onChange={(e) => onUpdate(node.id, { emailBody: e.target.value })} rows={4}/></div>
            <div><Label htmlFor={`${node.id}-emailfrom`}>De (E-mail - opcional)</Label><Input id={`${node.id}-emailfrom`} type="email" placeholder="remetente@exemplo.com" value={node.emailFrom || ''} onChange={(e) => onUpdate(node.id, { emailFrom: e.target.value })} /></div>
          </div>
        );
      case 'google-sheets-append':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-gsheetid`}>ID da Planilha Google</Label><Input id={`${node.id}-gsheetid`} placeholder="abc123xyz789" value={node.googleSheetId || ''} onChange={(e) => onUpdate(node.id, { googleSheetId: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-gsheetname`}>Nome da Aba</Label><Input id={`${node.id}-gsheetname`} placeholder="Página1" value={node.googleSheetName || ''} onChange={(e) => onUpdate(node.id, { googleSheetName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-gsheetdata`}>Dados da Linha (JSON array ou CSV)</Label><Textarea id={`${node.id}-gsheetdata`} placeholder='["{{input.valor1}}", "{{input.valor2}}"] ou {{input.valor1}},{{input.valor2}}' value={node.googleSheetRowData || ''} onChange={(e) => onUpdate(node.id, { googleSheetRowData: e.target.value })} rows={2}/></div>
            <p className="text-xs text-muted-foreground">Certifique-se que a API do Google Sheets está habilitada e as credenciais configuradas no servidor.</p>
          </div>
        );
      case 'intelligent-agent':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-agentname`}>Nome do Agente</Label><Input id={`${node.id}-agentname`} placeholder="Agente de Suporte N1" value={node.agentName || ''} onChange={(e) => onUpdate(node.id, { agentName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-agentsystemprompt`}>Prompt do Sistema / Instruções</Label><Textarea id={`${node.id}-agentsystemprompt`} placeholder="Você é um assistente virtual especializado em..." value={node.agentSystemPrompt || ''} onChange={(e) => onUpdate(node.id, { agentSystemPrompt: e.target.value })} rows={4}/></div>
            <div><Label htmlFor={`${node.id}-userinputvar`}>Variável com Entrada do Usuário</Label><Input id={`${node.id}-userinputvar`} placeholder="{{pergunta_usuario}}" value={node.userInputVariable || ''} onChange={(e) => onUpdate(node.id, { userInputVariable: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-agentresponsevar`}>Salvar Resposta na Variável</Label><Input id={`${node.id}-agentresponsevar`} placeholder="resposta_agente" value={node.agentResponseVariable || ''} onChange={(e) => onUpdate(node.id, { agentResponseVariable: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-aimodel`}>Modelo de IA (opcional)</Label><Input id={`${node.id}-aimodel`} placeholder="gemini-2.0-flash (padrão)" value={node.aiModelName || ''} onChange={(e) => onUpdate(node.id, { aiModelName: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-maxturns`}>Máx. Turnos (opcional)</Label><Input id={`${node.id}-maxturns`} type="number" placeholder="5" value={node.maxConversationTurns ?? ''} onChange={(e) => onUpdate(node.id, { maxConversationTurns: e.target.value ? parseInt(e.target.value, 10) : undefined })} /></div>
            <div>
              <Label htmlFor={`${node.id}-temperature`}>Temperatura (0-1, opcional)</Label>
              <div className="flex items-center space-x-2">
                <Slider
                  id={`${node.id}-temperature`}
                  min={0} max={1} step={0.01}
                  defaultValue={[node.temperature ?? 0.7]}
                  onValueChange={(value) => onUpdate(node.id, { temperature: value[0] })}
                  className="flex-1"
                />
                <Input
                  type="number" min={0} max={1} step={0.01}
                  value={node.temperature ?? 0.7}
                  onChange={(e) => onUpdate(node.id, { temperature: e.target.value ? parseFloat(e.target.value) : undefined })}
                  className="w-20"
                />
              </div>
            </div>
          </div>
        );
      case 'supabase-create-row':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`${node.id}-tableName`}>Nome da Tabela</Label>
              <Select value={node.supabaseTableName || ''} onValueChange={(value) => onUpdate(node.id, { supabaseTableName: value })}>
                <SelectTrigger id={`${node.id}-tableName`}><SelectValue placeholder="Selecione a Tabela" /></SelectTrigger>
                <SelectContent>
                  {exampleSupabaseTables.map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-dataJson`}>Dados da Linha (JSON)</Label><Textarea id={`${node.id}-dataJson`} placeholder='{ "coluna1": "valor1", "coluna2": "{{variavel}}" }' value={node.supabaseDataJson || ''} onChange={(e) => onUpdate(node.id, { supabaseDataJson: e.target.value })} rows={3}/></div>
            <p className="text-xs text-muted-foreground">A lógica de interação com Supabase (chamada à API/Server Action) deve ser implementada.</p>
          </div>
        );
      case 'supabase-read-row':
        return (
          <div className="space-y-3">
             <div>
              <Label htmlFor={`${node.id}-tableNameRead`}>Nome da Tabela</Label>
              <Select value={node.supabaseTableName || ''} onValueChange={(value) => onUpdate(node.id, { supabaseTableName: value })}>
                <SelectTrigger id={`${node.id}-tableNameRead`}><SelectValue placeholder="Selecione a Tabela" /></SelectTrigger>
                <SelectContent>
                  {exampleSupabaseTables.map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${node.id}-identifierColRead`}>Coluna Identificadora</Label>
              <Select value={node.supabaseIdentifierColumn || ''} onValueChange={(value) => onUpdate(node.id, { supabaseIdentifierColumn: value })}>
                <SelectTrigger id={`${node.id}-identifierColRead`}><SelectValue placeholder="Selecione a Coluna" /></SelectTrigger>
                <SelectContent>
                  {exampleSupabaseColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-identifierValRead`}>Valor do Identificador</Label><Input id={`${node.id}-identifierValRead`} placeholder="123 ou {{variavel_id}}" value={node.supabaseIdentifierValue || ''} onChange={(e) => onUpdate(node.id, { supabaseIdentifierValue: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-columnsToSelectRead`}>Colunas a Selecionar</Label><Input id={`${node.id}-columnsToSelectRead`} placeholder="*, nome, email" value={node.supabaseColumnsToSelect || '*'} onChange={(e) => onUpdate(node.id, { supabaseColumnsToSelect: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-resultVarRead`}>Salvar Resultado na Variável</Label><Input id={`${node.id}-resultVarRead`} placeholder="dados_lidos" value={node.supabaseResultVariable || ''} onChange={(e) => onUpdate(node.id, { supabaseResultVariable: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Implementar lógica de leitura do Supabase.</p>
          </div>
        );
      case 'supabase-update-row':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`${node.id}-tableNameUpdate`}>Nome da Tabela</Label>
              <Select value={node.supabaseTableName || ''} onValueChange={(value) => onUpdate(node.id, { supabaseTableName: value })}>
                <SelectTrigger id={`${node.id}-tableNameUpdate`}><SelectValue placeholder="Selecione a Tabela" /></SelectTrigger>
                <SelectContent>
                  {exampleSupabaseTables.map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${node.id}-identifierColUpdate`}>Coluna Identificadora</Label>
              <Select value={node.supabaseIdentifierColumn || ''} onValueChange={(value) => onUpdate(node.id, { supabaseIdentifierColumn: value })}>
                <SelectTrigger id={`${node.id}-identifierColUpdate`}><SelectValue placeholder="Selecione a Coluna" /></SelectTrigger>
                <SelectContent>
                  {exampleSupabaseColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-identifierValUpdate`}>Valor do Identificador</Label><Input id={`${node.id}-identifierValUpdate`} placeholder="123 ou {{variavel_id}}" value={node.supabaseIdentifierValue || ''} onChange={(e) => onUpdate(node.id, { supabaseIdentifierValue: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-dataJsonUpdate`}>Dados para Atualizar (JSON)</Label><Textarea id={`${node.id}-dataJsonUpdate`} placeholder='{ "coluna1": "novo_valor" }' value={node.supabaseDataJson || ''} onChange={(e) => onUpdate(node.id, { supabaseDataJson: e.target.value })} rows={3}/></div>
            <p className="text-xs text-muted-foreground">Implementar lógica de atualização do Supabase.</p>
          </div>
        );
      case 'supabase-delete-row':
        return (
          <div className="space-y-3">
            <div>
              <Label htmlFor={`${node.id}-tableNameDelete`}>Nome da Tabela</Label>
              <Select value={node.supabaseTableName || ''} onValueChange={(value) => onUpdate(node.id, { supabaseTableName: value })}>
                <SelectTrigger id={`${node.id}-tableNameDelete`}><SelectValue placeholder="Selecione a Tabela" /></SelectTrigger>
                <SelectContent>
                  {exampleSupabaseTables.map(table => <SelectItem key={table} value={table}>{table}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${node.id}-identifierColDelete`}>Coluna Identificadora</Label>
              <Select value={node.supabaseIdentifierColumn || ''} onValueChange={(value) => onUpdate(node.id, { supabaseIdentifierColumn: value })}>
                <SelectTrigger id={`${node.id}-identifierColDelete`}><SelectValue placeholder="Selecione a Coluna" /></SelectTrigger>
                <SelectContent>
                  {exampleSupabaseColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-identifierValDelete`}>Valor do Identificador</Label><Input id={`${node.id}-identifierValDelete`} placeholder="123 ou {{variavel_id}}" value={node.supabaseIdentifierValue || ''} onChange={(e) => onUpdate(node.id, { supabaseIdentifierValue: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">Implementar lógica de deleção do Supabase.</p>
          </div>
        );
      default:
        return <p className="text-xs text-muted-foreground italic">Nenhuma configuração para este tipo de nó.</p>;
    }
  };

  return (
    <motion.div
      className="w-full cursor-grab bg-card rounded-lg shadow-xl border border-border relative"
      whileHover={{ scale: 1.01, boxShadow: "0px 5px 25px rgba(0,0,0,0.1)" }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      data-node-id={node.id}
      aria-labelledby={`${node.id}-title`}
    >
      <Card className="shadow-none border-none bg-transparent">
        <CardHeader 
          onMouseDown={handleNodeMouseDown}
          data-drag-handle="true"
          className="py-2.5 px-3.5 bg-secondary/50 rounded-t-lg flex items-center justify-between cursor-grab active:cursor-grabbing"
        >
          <div className="flex items-center min-w-0 pointer-events-none">
            {renderNodeIcon()}
            <CardTitle id={`${node.id}-title`} className="ml-2 text-sm font-medium text-secondary-foreground truncate" title={node.title}>
              {node.title}
            </CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeleteClick}
            className="p-0.5 text-muted-foreground hover:text-destructive w-6 h-6"
            aria-label="Excluir nó" data-action="delete-node"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="p-3.5 text-sm">
          {renderNodeContent()}
        </CardContent>
      </Card>
      
      {node.type !== 'start' && (
        <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 z-10">
          <div
              title="Conecte aqui"
              className="w-5 h-5 bg-muted hover:bg-muted-foreground/50 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              data-connector="true" data-handle-type="target"
          />
        </div>
      )}
      
      {renderOutputConnectors()}
    </motion.div>
  );
});
NodeCard.displayName = 'NodeCard';
export default NodeCard;
