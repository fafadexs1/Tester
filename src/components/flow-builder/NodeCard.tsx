
"use client";

import React from 'react'; // Changed from "import type React"
import { useRef, useCallback } from 'react';
import type { NodeData } from '@/lib/types';
import { motion } from 'framer-motion';
import {
  MessageCircle, Hash, List, TerminalSquare, Trash2, BotMessageSquare,
  ImageUp, UserPlus2, GitFork, Variable, Webhook, Timer, Settings2,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { NODE_HEADER_CONNECTOR_Y_OFFSET, NODE_HEADER_HEIGHT_APPROX } from '@/lib/constants';

interface NodeCardProps {
  node: NodeData;
  onUpdate: (id: string, changes: Partial<NodeData>) => void;
  onStartConnection: (event: React.MouseEvent, fromId: string, sourceHandleId?: string) => void;
  onDeleteNode: (id: string) => void;
  canvasOffset: { x: number; y: number }; // Needed if node internal drag interacts with canvas offset
}

const NodeCard: React.FC<NodeCardProps> = React.memo(({ node, onUpdate, onStartConnection, onDeleteNode }) => {
  const isDraggingNode = useRef(false);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.dataset.connector === 'true' || target.closest('[data-action="delete-node"]')) {
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

  const renderNodeIcon = () => {
    const iconProps = { className: "w-5 h-5" };
    const icons: Record<NodeData['type'] | 'default', React.ReactNode> = {
      'message': <MessageCircle {...iconProps} color="hsl(var(--accent))" />,
      'input': <TerminalSquare {...iconProps} className="text-green-500" />, // Keeping some distinct colors for clarity
      'option': <List {...iconProps} className="text-purple-500" />,
      'whatsapp-text': <BotMessageSquare {...iconProps} className="text-teal-500" />,
      'whatsapp-media': <ImageUp {...iconProps} className="text-indigo-500" />,
      'whatsapp-group': <UserPlus2 {...iconProps} className="text-pink-500" />,
      'condition': <GitFork {...iconProps} className="text-orange-500" />,
      'set-variable': <Variable {...iconProps} className="text-cyan-500" />,
      'api-call': <Webhook {...iconProps} className="text-red-500" />,
      'delay': <Timer {...iconProps} className="text-yellow-500" />,
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
              title="True Output"
              className="w-5 h-5 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center cursor-crosshair shadow-md"
              onMouseDown={(e) => { e.stopPropagation(); onStartConnection(e, node.id, 'true'); }}
              data-connector="true" data-handle-type="source" data-handle-id="true"
            >
              <span className="text-xs text-white select-none">T</span>
            </div>
          </div>
          <div className="absolute -right-2.5 top-2/3 -translate-y-1/2 z-10">
            <div
              title="False Output"
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
          title="Drag to connect"
        >
          <Hash className="w-3 h-3 text-accent-foreground" />
        </div>
      </div>
    );
  };

  const renderNodeContent = () => {
    switch (node.type) {
      case 'message':
        return <Textarea placeholder="Bot message..." value={node.message || ''} onChange={(e) => onUpdate(node.id, { message: e.target.value })} className="resize-none text-sm" rows={3} />;
      case 'whatsapp-text':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-instance`}>Instance</Label><Input id={`${node.id}-instance`} placeholder="myInstance" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-phone`}>Phone</Label><Input id={`${node.id}-phone`} placeholder="55119..." value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-watext`}>Message</Label><Textarea id={`${node.id}-watext`} value={node.textMessage || ''} onChange={(e) => onUpdate(node.id, { textMessage: e.target.value })} rows={2}/></div>
          </div>
        );
      case 'whatsapp-media':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-instance`}>Instance</Label><Input id={`${node.id}-instance`} placeholder="myInstance" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-phone`}>Phone</Label><Input id={`${node.id}-phone`} placeholder="55119..." value={node.phoneNumber || ''} onChange={(e) => onUpdate(node.id, { phoneNumber: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-mediaurl`}>Media URL</Label><Input id={`${node.id}-mediaurl`} placeholder="https://..." value={node.mediaUrl || ''} onChange={(e) => onUpdate(node.id, { mediaUrl: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-mediatype`}>Type</Label>
              <Select value={node.mediaType || 'image'} onValueChange={(value) => onUpdate(node.id, { mediaType: value as NodeData['mediaType'] })}>
                <SelectTrigger id={`${node.id}-mediatype`}><SelectValue placeholder="Select media type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Image</SelectItem><SelectItem value="video">Video</SelectItem>
                  <SelectItem value="document">Document</SelectItem><SelectItem value="audio">Audio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-caption`}>Caption</Label><Input id={`${node.id}-caption`} value={node.caption || ''} onChange={(e) => onUpdate(node.id, { caption: e.target.value })}/></div>
          </div>
        );
      case 'whatsapp-group':
         return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-instance`}>Instance</Label><Input id={`${node.id}-instance`} placeholder="myInstance" value={node.instanceName || ''} onChange={(e) => onUpdate(node.id, { instanceName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-groupname`}>Group Name</Label><Input id={`${node.id}-groupname`} value={node.groupName || ''} onChange={(e) => onUpdate(node.id, { groupName: e.target.value })}/></div>
            <div><Label htmlFor={`${node.id}-participants`}>Participants (comma-separated)</Label><Textarea id={`${node.id}-participants`} value={node.participants || ''} onChange={(e) => onUpdate(node.id, { participants: e.target.value })} rows={2}/></div>
          </div>
        );
      case 'condition':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-condvar`}>Variable</Label><Input id={`${node.id}-condvar`} placeholder="{{variable}}" value={node.conditionVariable || ''} onChange={(e) => onUpdate(node.id, { conditionVariable: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-condop`}>Operator</Label>
              <Select value={node.conditionOperator || '=='} onValueChange={(value) => onUpdate(node.id, { conditionOperator: value as NodeData['conditionOperator']})}>
                <SelectTrigger id={`${node.id}-condop`}><SelectValue placeholder="Select operator" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="==">Equal to</SelectItem><SelectItem value="!=">Not equal to</SelectItem>
                  <SelectItem value=">">Greater than</SelectItem><SelectItem value="<">Less than</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem><SelectItem value="startsWith">Starts with</SelectItem>
                  <SelectItem value="endsWith">Ends with</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-condval`}>Value</Label><Input id={`${node.id}-condval`} placeholder="Value to compare" value={node.conditionValue || ''} onChange={(e) => onUpdate(node.id, { conditionValue: e.target.value })}/></div>
          </div>
        );
      case 'set-variable':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-varname`}>Variable Name</Label><Input id={`${node.id}-varname`} placeholder="myVariable" value={node.variableName || ''} onChange={(e) => onUpdate(node.id, { variableName: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-varval`}>Value</Label><Input id={`${node.id}-varval`} placeholder="Value or {{other_var}}" value={node.variableValue || ''} onChange={(e) => onUpdate(node.id, { variableValue: e.target.value })}/></div>
          </div>
        );
      case 'api-call':
        return (
          <div className="space-y-3">
            <div><Label htmlFor={`${node.id}-apiurl`}>URL</Label><Input id={`${node.id}-apiurl`} placeholder="https://api.example.com/data" value={node.apiUrl || ''} onChange={(e) => onUpdate(node.id, { apiUrl: e.target.value })} /></div>
            <div><Label htmlFor={`${node.id}-apimethod`}>Method</Label>
              <Select value={node.apiMethod || 'GET'} onValueChange={(value) => onUpdate(node.id, { apiMethod: value as NodeData['apiMethod']})}>
                <SelectTrigger id={`${node.id}-apimethod`}><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem><SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="PUT">PUT</SelectItem><SelectItem value="DELETE">DELETE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor={`${node.id}-apiheaders`}>Headers (JSON)</Label><Textarea id={`${node.id}-apiheaders`} placeholder='{ "Authorization": "Bearer ..." }' value={node.apiHeaders || ''} onChange={(e) => onUpdate(node.id, { apiHeaders: e.target.value })} rows={2}/></div>
            <div><Label htmlFor={`${node.id}-apibody`}>Body (JSON)</Label><Textarea id={`${node.id}-apibody`} placeholder='{ "key": "value" }' value={node.apiBody || ''} onChange={(e) => onUpdate(node.id, { apiBody: e.target.value })} rows={2}/></div>
          </div>
        );
      case 'delay':
        return (
          <div>
            <Label htmlFor={`${node.id}-delay`}>Duration (ms)</Label>
            <Input id={`${node.id}-delay`} type="number" placeholder="1000" value={node.delayDuration || ''} onChange={(e) => onUpdate(node.id, { delayDuration: parseInt(e.target.value, 10) || 0 })} />
          </div>
        );
      default:
        return <p className="text-xs text-muted-foreground italic">No configuration for this node type.</p>;
    }
  };

  return (
    <motion.div
      className="w-full cursor-grab bg-card rounded-lg shadow-xl border border-border relative"
      onMouseDown={handleNodeMouseDown}
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
            aria-label="Delete node" data-action="delete-node"
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
            title="Connect here"
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

