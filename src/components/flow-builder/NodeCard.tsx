"use client";

import React from 'react';
import { useRef, useCallback } from 'react';
import type { NodeData } from '@/lib/types';
import { motion } from 'framer-motion';
import {
  MessageSquareText, Type as InputIcon, ListChecks, Trash2, BotMessageSquare,
  ImageUp, UserPlus2, GitFork, Variable, Webhook, Timer, Settings2,
  CalendarDays, ExternalLink, MoreHorizontal, FileImage
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Hash } from 'lucide-react';

interface NodeCardProps {
  node: NodeData;
  onUpdate: (id: string, changes: Partial<NodeData>) => void;
  onStartConnection: (event: React.MouseEvent, fromId: string, sourceHandleId?: string) => void;
  onDeleteNode: (id: string) => void;
  // Removed canvasOffset as it's not used for node dragging logic here
}

const NodeCard: React.FC<NodeCardProps> = React.memo(({ node, onUpdate, onStartConnection, onDeleteNode }) => {
  const isDraggingNode = useRef(false);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // If clicking on a connector or delete button, let their specific handlers manage the event (they call stopPropagation)
    if (target.dataset.connector === 'true' || target.closest('[data-action="delete-node"]')) {
      // Event propagation is stopped by the specific handlers for connectors/delete
      return;
    }
    
    // If clicking on the card body, initiate node dragging
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
    e.stopPropagation(); // Prevent card drag
    onDeleteNode(node.id);
  }, [node.id, onDeleteNode]);

  const renderNodeIcon = () => {
    const iconProps = { className: "w-5 h-5" };
    const icons: Record<NodeData['type'] | 'default', React.ReactNode> = {
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
      default: <Settings2 {...iconProps} className="text-gray-500" />,
    };
    return icons[node.type] || icons.default;
  };
  
  const renderOutputConnectors = () => {
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

  const renderNodeContent = () => {
    switch (node.type) {
      case 'message':
        return <Textarea placeholder="Mensagem do bot..." value={node.text || ''} onChange={(e) => onUpdate(node.id, { text: e.target.value })} className="resize-none text-sm" rows={3} />;
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
            <div><Label htmlFor={`${node.id}-varsavechoice`}>Salvar Escolha na Variável</Label><Input id={`${node.id}-varsavechoice`} placeholder="variavel_escolha" value={node.variableToSaveChoice || ''} onChange={(e) => onUpdate(node.id, { variableToSaveChoice: e.target.value })} /></div>
          </div>
        );
      case 'whatsapp-text':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-instance`}>Instância</Label><Input id={`${node.id}-instance`} placeholder="minhaInstancia" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-phone`}>Telefone</Label><Input id={`${node.id}-phone`} placeholder="55119..." value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-watext`}>Mensagem</Label><Textarea id={`${node.id}-watext`} value={node.textMessage || ''} onChange={(e) => onUpdate(node.id, { textMessage: e.target.value })} rows={2}/></div>
          </div>
        );
      case 'whatsapp-media':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-instance`}>Instância</Label><Input id={`${node.id}-instance`} placeholder="minhaInstancia" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
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
            <div><Label htmlFor={`${node.id}-instance`}>Instância</Label><Input id={`${node.id}-instance`} placeholder="minhaInstancia" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
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
            <Input id={`${node.id}-delay`} type="number" placeholder="1000" value={node.delayDuration || ''} onChange={(e) => onUpdate(node.id, { delayDuration: parseInt(e.target.value, 10) || 0 })} />
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
            <Input id={`${node.id}-typingduration`} type="number" placeholder="1500" value={node.typingDuration || ''} onChange={(e) => onUpdate(node.id, { typingDuration: parseInt(e.target.value, 10) || 0 })} />
          </div>
        );
      case 'media-display':
        return (
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
        );
      default:
        return <p className="text-xs text-muted-foreground italic">Nenhuma configuração para este tipo de nó.</p>;
    }
  };

  return (
    <motion.div
      className="w-full cursor-grab bg-card rounded-lg shadow-xl border border-border relative"
      onMouseDown={handleNodeMouseDown} // This will now be the primary drag handler
      whileHover={{ scale: 1.01, boxShadow: "0px 5px 25px rgba(0,0,0,0.1)" }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      data-node-id={node.id}
      aria-labelledby={`${node.id}-title`}
    >
      <Card className="shadow-none border-none bg-transparent">
        <CardHeader className="py-2.5 px-3.5 bg-secondary/50 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center min-w-0">
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
      {/* Input Connector */}
      <div className="absolute -left-2.5 top-1/2 -translate-y-1/2 z-10">
        <div
            title="Conecte aqui"
            className="w-5 h-5 bg-muted hover:bg-muted-foreground/50 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
            data-connector="true" data-handle-type="target"
        />
      </div>
      {/* Output Connector(s) */}
      {renderOutputConnectors()}
    </motion.div>
  );
});
NodeCard.displayName = 'NodeCard';
export default NodeCard;
