

"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Send, Play, RotateCcw, MessageSquare, Loader2, LogOut, Webhook as WebhookIcon, FileJson2 } from 'lucide-react';
import type { WorkspaceData, NodeData, StartNodeTrigger } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';
import { getProperty, setProperty } from 'dot-prop';
import { classifyIntent } from '@/ai/flows/intention-classification-flow';
import jsonata from 'jsonata';


interface Message {
  id: string;
  text: string | React.ReactNode;
  sender: 'user' | 'bot';
  options?: (string | { id: string; value: string })[];
  // New property to store the chosen option's ID for user messages
  chosenOptionId?: string;
}

type AwaitingInputType = 'text' | 'option';

interface TestChatPanelProps {
  activeWorkspace: WorkspaceData | null | undefined;
}

const renderWithLineBreaks = (value: string, keyPrefix: string) =>
  value.split('\n').map((segment, idx, arr) => (
    <React.Fragment key={`${keyPrefix}-${idx}`}>
      {segment}
      {idx < arr.length - 1 && <br />}
    </React.Fragment>
  ));

const formatChatMessage = (text: string): React.ReactNode => {
  if (typeof text !== 'string') {
    return text;
  }
  // Regex para capturar formatação e variáveis
  const regex = /(\*.*?\*|_.*?_|~.*?~|```.*?```|\{\{.*?\}\})/g;
  const segments = text.split(regex);
  const matches = text.match(regex) || [];

  const result: React.ReactNode[] = [];
  let matchIndex = 0;

  for (let i = 0; i < segments.length; i++) {
    const plainSegment = segments[i];
    if (plainSegment) {
      result.push(
        <span key={`plain-${i}`} className="whitespace-pre-wrap break-words">
          {plainSegment}
        </span>
      );
    }

    const token = matches[matchIndex++];
    if (!token) continue;

    if (token.startsWith('*') && token.endsWith('*')) {
      result.push(
        <b key={`bold-${i}`} className="whitespace-pre-wrap break-words">
          {token.slice(1, -1)}
        </b>
      );
    } else if (token.startsWith('_') && token.endsWith('_')) {
      result.push(
        <i key={`italic-${i}`} className="whitespace-pre-wrap break-words">
          {token.slice(1, -1)}
        </i>
      );
    } else if (token.startsWith('~') && token.endsWith('~')) {
      result.push(
        <s key={`strike-${i}`} className="whitespace-pre-wrap break-words">
          {token.slice(1, -1)}
        </s>
      );
    } else if (token.startsWith('```') && token.endsWith('```')) {
      result.push(
        <pre
          key={`code-${i}`}
          className="font-mono bg-muted text-foreground p-1 rounded-sm whitespace-pre-wrap break-words text-xs"
        >
          {token.slice(3, -3)}
        </pre>
      );
    } else if (token.startsWith('{{') && token.endsWith('}}')) {
      result.push(
        <span key={`var-${i}`} className="font-mono text-xs bg-muted p-1 rounded-sm text-amber-500 break-words">
          {token}
        </span>
      );
    } else {
      result.push(
        <span key={`text-${i}`} className="whitespace-pre-wrap break-words">
          {token}
        </span>
      );
    }
  }

  return result;
};


const TestChatPanel: React.FC<TestChatPanelProps> = ({ activeWorkspace }) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null);
  const [flowVariables, setFlowVariables] = useState<Record<string, any>>({});
  const [awaitingInputFor, setAwaitingInputFor] = useState<NodeData | null>(null);
  const [awaitingInputType, setAwaitingInputType] = useState<AwaitingInputType>('text');
  const [isProcessingNode, setIsProcessingNode] = useState(false);

  const [isSimulateWebhookDialogOpen, setIsSimulateWebhookDialogOpen] = useState(false);
  const [webhookDialogJsonInput, setWebhookDialogJsonInput] = useState<string>('');
  const [currentOptions, setCurrentOptions] = useState<any[]>([]);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const activeFlowVariablesRef = useRef(flowVariables);

  useEffect(() => {
    activeFlowVariablesRef.current = flowVariables;
  }, [flowVariables]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const normalizeOptionsFromString = useCallback((raw: string): string[] => {
    if (!raw) return [];
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map(item => (item === null || item === undefined ? '' : String(item)))
            .map(item => item.trim())
            .filter(item => item.length > 0);
        }
      } catch {
        // fall back to splitting logic below
      }
    }
    const lines = raw.split(/\r?\n/)
      .map(opt => opt.replace(/^[\[\s,]+|[\],\s]+$/g, '').trim())
      .filter(opt => opt.length > 0);

    if (lines.length > 1) {
      return lines;
    }

    // If only one line, try other separators
    const validLine = lines[0];
    if (!validLine) return [];

    // Check for literal escaped newlines (e.g. "1\n2")
    if (validLine.includes('\\n')) {
      return validLine.split('\\n').map(s => s.trim()).filter(Boolean);
    }

    // Comma separated
    if (validLine.includes(',')) {
      return validLine.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Space separated IDs (numeric only, e.g. "1 10091")
    // Prevents splitting "Tentar Novamente"
    if (/^[\d.-]+(\s+[\d.-]+)+$/.test(validLine)) {
      return validLine.split(/\s+/).map(s => s.trim()).filter(Boolean);
    }

    return [validLine];
  }, []);

  const getNodeById = useCallback((nodeId: string): NodeData | undefined => {
    return activeWorkspace?.nodes.find(n => n.id === nodeId);
  }, [activeWorkspace]);

  const normalizeHandle = (value?: string | null) => {
    if (value === undefined || value === null) return 'default';
    if (typeof value === 'string') return value.trim() || 'default';
    return String(value).trim() || 'default';
  };

  const findNextNodeId = useCallback((fromNodeId: string, sourceHandle?: string): string | null => {
    if (!activeWorkspace) return null;
    const desiredHandle = normalizeHandle(sourceHandle);
    console.log(`[TestChatPanel] findNextNodeId: fromNodeId=${fromNodeId}, desiredHandle=${desiredHandle}`);

    const connection =
      activeWorkspace.connections.find(conn => conn.from === fromNodeId && normalizeHandle(conn.sourceHandle) === desiredHandle) ??
      (desiredHandle === 'default'
        ? activeWorkspace.connections.find(conn => conn.from === fromNodeId && !conn.sourceHandle)
        : null) ??
      activeWorkspace.connections.find(conn => conn.from === fromNodeId && normalizeHandle(conn.sourceHandle) === 'default');

    if (!connection) {
      const availableHandles = activeWorkspace.connections
        .filter(conn => conn.from === fromNodeId)
        .map(conn => normalizeHandle(conn.sourceHandle));
      console.warn(
        `[TestChatPanel] No connection found from node ${fromNodeId} for handle "${desiredHandle}". Available handles: ${availableHandles.join(
          ', '
        ) || 'none'}.`
      );
      return null;
    }

    console.log('[TestChatPanel] findNextNodeId: found connection', connection);
    return connection.to ?? null;
  }, [activeWorkspace]);

  const substituteVariables = useCallback((text: string | undefined | null, currentActiveFlowVariables: Record<string, any>): string => {
    if (text === undefined || text === null) {
      return '';
    }
    let mutableText = String(text);
    const variableRegex = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

    const substitutedText = mutableText.replace(variableRegex, (match, variableName) => {

      if (variableName === 'now') {
        return new Date().toISOString();
      }

      let value: any = getProperty(currentActiveFlowVariables, variableName);

      if (value === undefined) {
        value = currentActiveFlowVariables[variableName];
      }

      if (value === undefined || value === null) {
        console.warn(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" resolved to undefined/null. Vars:`, JSON.parse(JSON.stringify(currentActiveFlowVariables)));
        return '';
      }
      if (Array.isArray(value)) {
        console.log(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" is array, joining items.`);
        return value.map(v => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join('\n');
      }

      if (typeof value === 'object') {
        console.log(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" is object, stringifying.`);
        try {
          return JSON.stringify(value, null, 2);
        } catch (e) {
          console.error(`[TestChatPanel] substituteVariables: Failed to stringify object/array for variable "{{${variableName}}}". Error:`, e);
          return `[Error stringifying object for ${variableName}]`;
        }
      }
      console.log(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" replaced with "${String(value)}".`);
      return String(value);
    });
    return substitutedText;
  }, []);


  const getSupabaseClient = (): SupabaseClient | null => {
    const supabaseUrl = localStorage.getItem('supabaseUrl');
    const supabaseAnonKey = localStorage.getItem('supabaseAnonKey');
    const isSupabaseEnabled = localStorage.getItem('isSupabaseEnabled') === 'true';

    if (!isSupabaseEnabled) {
      console.warn('[TestChatPanel] Supabase integration is not enabled in settings.');
      setMessages(prev => [...prev, { id: uuidv4(), text: "Erro: A integração com Supabase não está habilitada nas Configurações Globais.", sender: 'bot' }]);
      return null;
    }

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[TestChatPanel] Supabase URL or Anon Key not found in localStorage.');
      setMessages(prev => [...prev, { id: uuidv4(), text: "Erro: URL do Supabase ou Chave Anônima não configuradas. Verifique as Configurações Globais.", sender: 'bot' }]);
      return null;
    }
    try {
      return createClient(supabaseUrl, supabaseAnonKey);
    } catch (e: any) {
      console.error('[TestChatPanel] Error creating Supabase client:', e);
      setMessages(prev => [...prev, { id: uuidv4(), text: `Erro ao inicializar cliente Supabase: ${e.message}`, sender: 'bot' }]);
      return null;
    }
  };

  const handleEndChatTest = useCallback(() => {
    console.log('[TestChatPanel] handleEndChatTest called');
    setMessages(prev => [...prev, { id: uuidv4(), text: "Teste encerrado pelo usuário.", sender: 'bot' }]);
    setIsTesting(false);
    setAwaitingInputFor(null);
    setAwaitingInputType('text');
    setCurrentNodeId(null);
    setIsProcessingNode(false);
  }, []);

  const processNode = useCallback(async (nodeId: string | null, receivedVars: Record<string, any>) => {
    console.log(`[TestChatPanel] processNode ENTER: nodeId: ${nodeId}, receivedVars:`, JSON.parse(JSON.stringify(receivedVars)));
    setIsProcessingNode(true);
    setCurrentNodeId(nodeId);

    let activeVars = { ...receivedVars };
    console.log(`[TestChatPanel] processNode: effective activeVars for this node execution:`, JSON.parse(JSON.stringify(activeVars)));

    if (!activeWorkspace) {
      console.error('[TestChatPanel] processNode: activeWorkspace is null or undefined.');
      setMessages(prev => [...prev, { id: uuidv4(), text: "Erro crítico: Fluxo ativo não encontrado.", sender: 'bot' }]);
      handleEndChatTest();
      setIsProcessingNode(false);
      return;
    }

    if (!nodeId) {
      setMessages(prev => [...prev, { id: uuidv4(), text: "Fim do caminho atual. O fluxo está pausado. Use 'Encerrar Teste' ou 'Reiniciar Teste'.", sender: 'bot' }]);
      setAwaitingInputFor(null);
      setIsProcessingNode(false);
      return;
    }

    const node = getNodeById(nodeId);
    if (!node) {
      console.error(`[TestChatPanel] processNode: Node with ID ${nodeId} not found.`);
      setMessages(prev => [...prev, { id: uuidv4(), text: `Erro: Nó com ID ${nodeId} não encontrado. Fim da simulação.`, sender: 'bot' }]);
      handleEndChatTest();
      setIsProcessingNode(false);
      return;
    }

    console.log(`[TestChatPanel] Processing node:`, JSON.parse(JSON.stringify(node)));
    console.log(`[TestChatPanel] Current flowVariables before processing node (using activeVars):`, JSON.parse(JSON.stringify(activeVars)));

    let nextNodeId: string | null = null;
    let autoAdvance = true;
    let updatedVarsForNextNode = { ...activeVars };

    if (node.type !== 'start' && node.type !== 'delay' && node.type !== 'end-flow' && node.type !== 'typing-emulation') {
      const typingMessageId = uuidv4();
      setMessages(prev => [...prev, { id: typingMessageId, text: <Loader2 className="h-4 w-4 animate-spin mr-2 inline-block" />, sender: 'bot' }]);
      await new Promise(resolve => setTimeout(resolve, 600));
      setMessages(prev => prev.filter(m => m.id !== typingMessageId));
    }

    switch (node.type) {
      case 'start':
        const triggerNameToUse = updatedVarsForNextNode._triggerName || (node.triggers && node.triggers.length > 0 ? node.triggers[0].name : 'default');
        setMessages(prev => [...prev, { id: uuidv4(), text: `Iniciando fluxo a partir de: ${node.title || 'Nó de Início'} com gatilho: "${triggerNameToUse}"`, sender: 'bot' }]);

        nextNodeId = findNextNodeId(node.id, triggerNameToUse);
        if (!nextNodeId && node.triggers && node.triggers.length > 0 && triggerNameToUse !== node.triggers[0].name) {
          console.warn(`[TestChatPanel] Trigger "${triggerNameToUse}" not directly connected, trying first trigger "${node.triggers[0].name}" as default for webhook start.`);
          nextNodeId = findNextNodeId(node.id, node.triggers[0].name);
        }
        if (!nextNodeId && (!node.triggers || node.triggers.length === 0 || triggerNameToUse !== 'default')) {
          console.warn(`[TestChatPanel] Trigger "${triggerNameToUse}" (or first trigger) not connected, trying 'default' output.`);
          nextNodeId = findNextNodeId(node.id, 'default');
        }

        if (!nextNodeId) {
          setMessages(prev => [...prev, { id: uuidv4(), text: `Nó de início (ou gatilho "${triggerNameToUse}") não tem conexões de saída.`, sender: 'bot' }]);
          autoAdvance = false;
        }
        if (updatedVarsForNextNode._triggerName) delete updatedVarsForNextNode._triggerName;
        break;

      case 'message': {
        const messageText = substituteVariables(node.text, updatedVarsForNextNode);
        if (messageText) {
          setMessages(prev => [...prev, { id: uuidv4(), text: messageText, sender: 'bot' }]);
        } else {
          setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de mensagem vazio ou variável não resolvida)", sender: 'bot' }]);
        }

        if (activeWorkspace?.evolution_api_enabled) {
          const phoneNumber = activeVars.whatsapp_sender_jid;
          if (phoneNumber) {
            if (activeWorkspace.evolution_api_url && messageText) {
              console.log(`[TestChatPanel] Attempting to send message node text via WhatsApp to ${phoneNumber}`);
              sendWhatsAppMessageAction({
                baseUrl: activeWorkspace.evolution_api_url,
                apiKey: activeWorkspace.evolution_api_key || undefined,
                instanceName: activeWorkspace.evolution_instance_name || 'evolution_instance',
                recipientPhoneNumber: phoneNumber,
                messageType: 'text',
                textContent: messageText,
              }).then(result => {
                if (result.success) {
                  setMessages(prev => [...prev, { id: uuidv4(), text: `(Mensagem enviada para ${phoneNumber} via WhatsApp)`, sender: 'bot' }]);
                } else {
                  setMessages(prev => [...prev, { id: uuidv4(), text: `(Falha ao enviar via WhatsApp: ${result.error})`, sender: 'bot' }]);
                }
              });
            }
          }
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }

      case 'input': {
        const promptText = substituteVariables(node.promptText, updatedVarsForNextNode);
        if (promptText) {
          setMessages(prev => [...prev, { id: uuidv4(), text: promptText, sender: 'bot' }]);
          if (activeWorkspace?.evolution_api_enabled) {
            const phoneNumber = activeVars.whatsapp_sender_jid;
            if (phoneNumber) {
              // Lógica similar ao nó 'message' para enviar promptText
            }
          }
        } else {
          setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de entrada sem pergunta ou variável não resolvida)", sender: 'bot' }]);
        }
        setAwaitingInputFor(node);
        setAwaitingInputType('text');
        autoAdvance = false;
        break;
      }

      case 'option': {
        const questionText = substituteVariables(node.questionText, updatedVarsForNextNode);

        let optionsList: (string | { id: string; value: string })[] = [];
        if (Array.isArray(node.options) && node.options.length > 0) {
          optionsList = node.options.flatMap(opt => {
            const val = substituteVariables(opt.value, updatedVarsForNextNode);
            // Only split if variable was present
            if (opt.value && opt.value.includes('{{')) {
              const splitVals = normalizeOptionsFromString(val);
              if (splitVals.length > 1) {
                return splitVals.map((v, i) => ({ id: `${opt.id}_${i}`, value: v }));
              }
            }
            return [{ id: opt.id, value: val }];
          });
        } else {
          const substitutedOptions = substituteVariables(node.optionsList, updatedVarsForNextNode);
          optionsList = normalizeOptionsFromString(substitutedOptions);
        }

        if (questionText && optionsList.length > 0) {
          setMessages(prev => [...prev, {
            id: uuidv4(),
            text: questionText,
            sender: 'bot',
            options: optionsList
          }]);
          if (activeWorkspace?.evolution_api_enabled) {
            const phoneNumber = activeVars.whatsapp_sender_jid;
            if (phoneNumber) {
              // Lógica similar ao nó 'message' para enviar questionText
            }
          }
          setCurrentOptions(optionsList);
          setAwaitingInputFor(node);
          setAwaitingInputType('option');
        } else {
          setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de opções mal configurado ou variável não resolvida)", sender: 'bot' }]);
        }
        autoAdvance = false;
        break;
      }

      case 'condition':
        let conditionMet = false;
        const conditionVarField = node.conditionVariable;
        const conditionOperator = node.conditionOperator;
        const conditionCompareValueField = node.conditionValue;

        let actualValue: any;
        let displayVarName = conditionVarField || '';

        if (conditionVarField) {
          actualValue = getProperty(updatedVarsForNextNode, substituteVariables(conditionVarField, updatedVarsForNextNode).replace(/\{\{|\}\}/g, ''));
          if (actualValue === undefined) actualValue = substituteVariables(conditionVarField, updatedVarsForNextNode); // Fallback se não for placeholder
          displayVarName = conditionVarField;
        }

        const valueToCompare = conditionCompareValueField
          ? substituteVariables(conditionCompareValueField, updatedVarsForNextNode)
          : undefined;

        setMessages(prev => [...prev, { id: uuidv4(), text: `Avaliando condição: '${displayVarName}' (valor: ${JSON.stringify(actualValue)}) ${conditionOperator} '${valueToCompare === undefined ? 'N/A' : valueToCompare}'`, sender: 'bot' }]);
        console.log(`[TestChatPanel] Condition Eval: Var Field: "${conditionVarField}", Resolved Actual Value:`, actualValue, `(Type: ${typeof actualValue})`, `Operator: "${conditionOperator}", Compare Value Field: "${conditionCompareValueField}", Resolved Compare Value:`, valueToCompare, `(Type: ${typeof valueToCompare})`);

        const valStr = String(actualValue ?? '').toLowerCase();
        const compareValStr = String(valueToCompare ?? '').toLowerCase();

        switch (conditionOperator) {
          case '==': conditionMet = valStr === compareValStr; break;
          case '!=': conditionMet = valStr !== compareValStr; break;
          case '>': conditionMet = Number(actualValue) > Number(valueToCompare); break;
          case '<': conditionMet = Number(actualValue) < Number(valueToCompare); break;
          case 'contains': conditionMet = valStr.includes(compareValStr); break;
          case 'startsWith': conditionMet = valStr.startsWith(compareValStr); break;
          case 'endsWith': conditionMet = valStr.endsWith(compareValStr); break;
          case 'isEmpty':
            conditionMet = actualValue === undefined || actualValue === null || String(actualValue).trim() === '';
            break;
          case 'isNotEmpty':
            conditionMet = actualValue !== undefined && actualValue !== null && String(actualValue).trim() !== '';
            break;
          default:
            setMessages(prev => [...prev, { id: uuidv4(), text: `Operador de condição '${conditionOperator}' desconhecido. Assumindo falso.`, sender: 'bot' }]);
            conditionMet = false;
        }

        setMessages(prev => [...prev, { id: uuidv4(), text: `Resultado da condição: ${conditionMet ? 'Verdadeiro' : 'Falso'}.`, sender: 'bot' }]);
        nextNodeId = findNextNodeId(node.id, conditionMet ? 'true' : 'false');
        if (!nextNodeId) {
          setMessages(prev => [...prev, { id: uuidv4(), text: `Caminho para '${conditionMet ? 'true' : 'false'}' não conectado. Tentando 'default' se existir.`, sender: 'bot' }]);
          nextNodeId = findNextNodeId(node.id, 'default');
        }
        break;

      case 'switch': {
        const rawSwitchField = (node.switchVariable || '').toString();
        const normalizedVarName = rawSwitchField.replace(/\{\{|\}\}/g, '').trim();
        let actualValue: any = undefined;

        if (normalizedVarName) {
          actualValue = getProperty(updatedVarsForNextNode, normalizedVarName);
        }

        if (actualValue === undefined && rawSwitchField) {
          actualValue = substituteVariables(node.switchVariable, updatedVarsForNextNode);
        }

        setMessages(prev => [
          ...prev,
          {
            id: uuidv4(),
            text: `Switch avaliando "${normalizedVarName || rawSwitchField}" com valor ${JSON.stringify(actualValue)}.`,
            sender: 'bot',
          },
        ]);

        let matchedCaseId: string | null = null;
        let matchedCaseValue: string | null = null;

        if (Array.isArray(node.switchCases)) {
          for (const caseItem of node.switchCases) {
            const caseValue = substituteVariables(caseItem.value, updatedVarsForNextNode);
            if (String(actualValue) === String(caseValue)) {
              matchedCaseId = caseItem.id;
              matchedCaseValue = caseValue;
              break;
            }
          }
        }

        if (matchedCaseId) {
          setMessages(prev => [
            ...prev,
            {
              id: uuidv4(),
              text: `Switch encontrou correspondência com o caso "${matchedCaseValue}". Seguiremos por "${matchedCaseId}".`,
              sender: 'bot',
            },
          ]);
          nextNodeId = findNextNodeId(node.id, matchedCaseId) ?? findNextNodeId(node.id, 'default');
        } else {
          setMessages(prev => [
            ...prev,
            {
              id: uuidv4(),
              text: `Nenhum caso do switch correspondeu. Usando caminho 'otherwise'.`,
              sender: 'bot',
            },
          ]);
          nextNodeId = findNextNodeId(node.id, 'otherwise') ?? findNextNodeId(node.id, 'default');
        }

        if (!nextNodeId) {
          setMessages(prev => [
            ...prev,
            {
              id: uuidv4(),
              text: `Switch sem conexões configuradas para o resultado escolhido.`,
              sender: 'bot',
            },
          ]);
        }
        break;
      }

      case 'delay':
        const duration = node.delayDuration || 1000;
        setMessages(prev => [...prev, { id: uuidv4(), text: `Aguardando ${duration / 1000} segundos...`, sender: 'bot' }]);
        await new Promise(resolve => setTimeout(resolve, duration));
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'set-variable':
        if (node.variableName && node.variableName.trim() !== '') {
          const valueToSet = node.variableValue ? substituteVariables(node.variableValue, updatedVarsForNextNode) : '';
          const varName = node.variableName as string;
          updatedVarsForNextNode = { ...updatedVarsForNextNode, [varName]: valueToSet };
          setMessages(prev => [...prev, { id: uuidv4(), text: `Variável "${varName}" definida como "${valueToSet}".`, sender: 'bot' }]);
          console.log(`[TestChatPanel] Variable Set: ${varName} = ${valueToSet}. New vars for next step:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
        } else {
          setMessages(prev => [...prev, { id: uuidv4(), text: `Nó "Definir Variável" sem nome de variável configurado.`, sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'whatsapp-text':
      case 'whatsapp-media': {
        if (!activeWorkspace?.evolution_api_enabled) {
          setMessages(prev => [...prev, { id: uuidv4(), text: "Envio WhatsApp pulado: Integração API Evolution não habilitada neste fluxo.", sender: 'bot' }]);
        } else {
          setMessages(prev => [...prev, { id: uuidv4(), text: `Tentando enviar mensagem WhatsApp (${node.type})...`, sender: 'bot' }]);

          const nodeInstanceName = substituteVariables(node.instanceName, updatedVarsForNextNode);
          const instanceNameToUse = nodeInstanceName || activeWorkspace.evolution_instance_name || 'evolution_instance';

          let recipientPhoneNumber = substituteVariables(node.phoneNumber, updatedVarsForNextNode);
          if (!recipientPhoneNumber && updatedVarsForNextNode.whatsapp_sender_jid) {
            recipientPhoneNumber = updatedVarsForNextNode.whatsapp_sender_jid;
            console.log(`[TestChatPanel] WhatsApp: Usando whatsapp_sender_jid (${recipientPhoneNumber}) como destinatário para nó ${node.id}.`);
          }

          if (!activeWorkspace.evolution_api_url) {
            setMessages(prev => [...prev, { id: uuidv4(), text: "Erro: URL base da API Evolution não configurada neste fluxo.", sender: 'bot' }]);
          } else if (!recipientPhoneNumber) {
            setMessages(prev => [...prev, { id: uuidv4(), text: `Erro: Número de telefone do destinatário não fornecido no nó "${node.title}" nem encontrado em whatsapp_sender_jid.`, sender: 'bot' }]);
          } else {
            try {
              const result = await sendWhatsAppMessageAction({
                baseUrl: activeWorkspace.evolution_api_url,
                apiKey: activeWorkspace.evolution_api_key || undefined,
                instanceName: instanceNameToUse,
                recipientPhoneNumber: recipientPhoneNumber,
                messageType: node.type === 'whatsapp-text' ? 'text' : node.mediaType || 'image',
                textContent: node.type === 'whatsapp-text' ? substituteVariables(node.textMessage, updatedVarsForNextNode) : undefined,
                mediaUrl: node.type === 'whatsapp-media' ? substituteVariables(node.mediaUrl, updatedVarsForNextNode) : undefined,
                caption: node.type === 'whatsapp-media' ? substituteVariables(node.caption, updatedVarsForNextNode) : undefined,
              });

              if (result.success) {
                setMessages(prev => [...prev, { id: uuidv4(), text: `WhatsApp: Mensagem enviada com sucesso para ${recipientPhoneNumber} via instância ${instanceNameToUse}. (Resposta API: ${JSON.stringify(result.data)})`, sender: 'bot' }]);
              } else {
                setMessages(prev => [...prev, { id: uuidv4(), text: `WhatsApp: Erro ao enviar mensagem: ${result.error || 'Erro desconhecido'} (Detalhes: ${JSON.stringify(result.data)})`, sender: 'bot' }]);
              }
            } catch (error: any) {
              setMessages(prev => [...prev, { id: uuidv4(), text: `WhatsApp: Exceção ao enviar mensagem: ${error.message}`, sender: 'bot' }]);
            }
          }
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }
      case 'whatsapp-group':
        setMessages(prev => [...prev, { id: uuidv4(), text: `(Simulando criação de grupo WhatsApp: '${substituteVariables(node.groupName, updatedVarsForNextNode)}')`, sender: 'bot' }]);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'supabase-create-row':
      case 'supabase-read-row':
      case 'supabase-update-row':
      case 'supabase-delete-row': {
        setMessages(prev => [...prev, { id: uuidv4(), text: `Executando ${node.type} no Supabase para: ${node.title || node.type}...`, sender: 'bot' }]);
        const supabase = getSupabaseClient();
        if (!supabase) {
          autoAdvance = false;
          nextNodeId = null;
          break;
        }

        const tableName = substituteVariables(node.supabaseTableName, updatedVarsForNextNode);
        const idColumn = substituteVariables(node.supabaseIdentifierColumn, updatedVarsForNextNode);
        let idValue = substituteVariables(node.supabaseIdentifierValue, updatedVarsForNextNode);
        let dataJsonString = substituteVariables(node.supabaseDataJson, updatedVarsForNextNode);
        let columnsToSelect = substituteVariables(node.supabaseColumnsToSelect, updatedVarsForNextNode).trim();

        if (!columnsToSelect && (node.type === 'supabase-read-row' || node.type === 'supabase-create-row' || node.type === 'supabase-update-row')) {
          columnsToSelect = '*';
        }

        console.log(`[TestChatPanel] Supabase Op: ${node.type} - Table: ${tableName}, ID Col: ${idColumn}, ID Val: ${idValue}, DataJSON: ${dataJsonString}, Select: ${columnsToSelect}`);

        let operationSucceeded = false;
        let resultDataToSave: any = null;

        try {
          if (!tableName) throw new Error("Nome da tabela Supabase não fornecido ou inválido.");

          if (node.type === 'supabase-create-row') {
            if (!dataJsonString) { throw new Error("Dados JSON para criação não fornecidos."); }
            let dataToInsert = JSON.parse(dataJsonString);
            const { data, error } = await supabase.from(tableName).insert(dataToInsert).select(columnsToSelect);
            if (error) throw error;
            resultDataToSave = data && data.length > 0 ? data[0] : data;
            operationSucceeded = true;
            setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Linha criada na tabela '${tableName}'. Resultado: ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
          } else if (node.type === 'supabase-read-row') {
            let query = supabase.from(tableName).select(columnsToSelect);
            if (idColumn && (idValue !== undefined && idValue !== null && String(idValue).trim() !== '')) {
              query = query.eq(idColumn, String(idValue));
            }
            const { data, error } = await query;
            if (error) throw error;

            console.log(`[TestChatPanel] Supabase read RAW data for node ${node.id}:`, data);
            if (data && data.length > 0) {
              if (data.length === 1 && Object.keys(data[0]).length === 1) {
                resultDataToSave = Object.values(data[0])[0];
                setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Valor lido de '${tableName}.${Object.keys(data[0])[0]}': ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
              } else {
                resultDataToSave = data.length === 1 ? data[0] : data;
                setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Dados lidos da tabela '${tableName}': ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
              }
            } else {
              resultDataToSave = null;
              setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Nenhum registro encontrado na tabela '${tableName}'${idColumn && idValue ? ` com ${idColumn} = '${idValue}'` : ''}.`, sender: 'bot' }]);
            }
            operationSucceeded = true;
          } else if (node.type === 'supabase-update-row') {
            if (!idColumn || (idValue === undefined || idValue === null || String(idValue).trim() === '') || !dataJsonString) { throw new Error("Informações incompletas para atualização."); }
            let dataToUpdate = JSON.parse(dataJsonString);
            const { data, error } = await supabase.from(tableName).update(dataToUpdate).eq(idColumn, String(idValue)).select(columnsToSelect);
            if (error) throw error;
            resultDataToSave = data && data.length > 0 ? data[0] : data;
            operationSucceeded = true;
            setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Linha atualizada na tabela '${tableName}'. Resultado: ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
          } else if (node.type === 'supabase-delete-row') {
            if (!idColumn || (idValue === undefined || idValue === null || String(idValue).trim() === '')) { throw new Error("Informações incompletas para deleção."); }
            const { error, data } = await supabase.from(tableName).delete().eq(idColumn, String(idValue)).select(); // Select pode retornar os dados deletados
            if (error) throw error;
            operationSucceeded = true;
            setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Linha(s) deletada(s) da tabela '${tableName}'. Dados afetados: ${JSON.stringify(data, null, 2)}`, sender: 'bot' }]);
          }

          if (operationSucceeded && node.supabaseResultVariable && node.supabaseResultVariable.trim() !== '') {
            const varName = node.supabaseResultVariable as string;
            console.log(`[TestChatPanel] ${node.type.toUpperCase().replace('SUPABASE-', '')}: Attempting to set variable "${varName}" with data:`, JSON.parse(JSON.stringify(resultDataToSave)));
            updatedVarsForNextNode = { ...updatedVarsForNextNode, [varName]: resultDataToSave };
            console.log(`[TestChatPanel] ${node.type.toUpperCase().replace('SUPABASE-', '')}: Variable "${varName}" set. New temp flowVariables:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
            setMessages(prev => [...prev, { id: uuidv4(), text: `Variável "${varName}" definida com o resultado Supabase.`, sender: 'bot' }]);
          }

        } catch (e: any) {
          console.error(`[TestChatPanel] Supabase ${node.type} error for node ${node.id}:`, e);
          setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Erro na operação ${node.type}: ${e.message}`, sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }

      case 'api-call': {
        const url = substituteVariables(node.apiUrl, updatedVarsForNextNode);
        const method = node.apiMethod || 'GET';
        if (!url) {
          setMessages(prev => [...prev, { id: uuidv4(), text: "Erro: URL da Chamada API não configurada.", sender: 'bot' }]);
          nextNodeId = findNextNodeId(node.id, 'default');
          break;
        }

        setMessages(prev => [...prev, { id: uuidv4(), text: `Processando nó: ${node.title || 'Chamada API'} (${method} ${url})...`, sender: 'bot' }]);

        const headersList = (node.apiHeadersList || []).map(header => ({
          id: header.id,
          key: substituteVariables(header.key, updatedVarsForNextNode),
          value: substituteVariables(header.value, updatedVarsForNextNode),
        })).filter(h => h.key);

        const queryParamsList = (node.apiQueryParamsList || []).map(param => ({
          id: param.id,
          key: substituteVariables(param.key, updatedVarsForNextNode),
          value: substituteVariables(param.value, updatedVarsForNextNode),
        })).filter(q => q.key);

        const bodyDetails: any = { type: node.apiBodyType || 'none' };
        if (node.apiBodyType === 'json' && node.apiBodyJson) {
          bodyDetails.json = substituteVariables(node.apiBodyJson, updatedVarsForNextNode);
        } else if (node.apiBodyType === 'raw' && node.apiBodyRaw) {
          bodyDetails.raw = substituteVariables(node.apiBodyRaw, updatedVarsForNextNode);
        } else if (node.apiBodyType === 'form-data' && node.apiBodyFormDataList) {
          bodyDetails.formData = node.apiBodyFormDataList.map(entry => ({
            id: entry.id,
            key: substituteVariables(entry.key, updatedVarsForNextNode),
            value: substituteVariables(entry.value, updatedVarsForNextNode),
          })).filter(e => e.key);
        }

        const authConfig = node.apiAuthType && node.apiAuthType !== 'none'
          ? {
            type: node.apiAuthType,
            bearerToken: substituteVariables(node.apiAuthBearerToken, updatedVarsForNextNode),
            basicUser: substituteVariables(node.apiAuthBasicUser, updatedVarsForNextNode),
            basicPassword: substituteVariables(node.apiAuthBasicPassword, updatedVarsForNextNode),
          }
          : { type: 'none' };

        try {
          const response = await fetch('/api/test-api-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url,
              method,
              headers: headersList,
              queryParams: queryParamsList,
              auth: authConfig,
              body: bodyDetails,
            }),
          });

          const result = await response.json();
          if (!response.ok) {
            setMessages(prev => [...prev, { id: uuidv4(), text: `Erro ao executar Chamada API: ${result.error || 'Falha desconhecida.'}`, sender: 'bot' }]);
          } else {
            const responseData = result.data;
            const statusText = result.status ? `Status ${result.status}` : 'Resposta recebida';
            setMessages(prev => [...prev, {
              id: uuidv4(),
              text: `${statusText}: ${typeof responseData === 'string' ? responseData : JSON.stringify(responseData, null, 2)}`,
              sender: 'bot'
            }]);

            let valueForVariable = responseData;
            if (node.apiResponsePath) {
              try {
                const expression = jsonata(node.apiResponsePath);
                valueForVariable = await expression.evaluate(responseData);
              } catch (e: any) {
                console.error(`[TestChatPanel] Erro ao aplicar JSONata (${node.apiResponsePath}):`, e);
              }
            }

            if (node.apiOutputVariable && node.apiOutputVariable.trim() !== '') {
              setProperty(updatedVarsForNextNode, node.apiOutputVariable, valueForVariable);
              setMessages(prev => [...prev, {
                id: uuidv4(),
                text: `Variável "${node.apiOutputVariable}" atualizada com o retorno da API.`,
                sender: 'bot'
              }]);
            }

            if (node.apiResponseMappings && Array.isArray(node.apiResponseMappings)) {
              for (const mapping of node.apiResponseMappings) {
                if (mapping.jsonPath && mapping.flowVariable) {
                  try {
                    const expression = jsonata(mapping.jsonPath);
                    const extracted = await expression.evaluate(responseData);

                    if (mapping.extractAs === 'list') {
                      const rawList = Array.isArray(extracted)
                        ? extracted
                        : (extracted === undefined || extracted === null ? [] : [extracted]);

                      const normalizedList = mapping.itemField
                        ? rawList.map(item => {
                          if (item === undefined || item === null) return undefined;
                          if (typeof item === 'object') {
                            return getProperty(item, mapping.itemField!);
                          }
                          return item;
                        }).filter(item => item !== undefined && item !== null)
                        : rawList;

                      setProperty(updatedVarsForNextNode, mapping.flowVariable, normalizedList);
                    } else {
                      setProperty(updatedVarsForNextNode, mapping.flowVariable, extracted);
                    }

                    setMessages(prev => [...prev, {
                      id: uuidv4(),
                      text: `Mapeamento aplicado: "${mapping.flowVariable}" atualizado.`,
                      sender: 'bot'
                    }]);
                  } catch (e: any) {
                    console.error(`[TestChatPanel] Erro no mapeamento JSONata (${mapping.jsonPath}):`, e);
                    setMessages(prev => [...prev, { id: uuidv4(), text: `Falha no mapeamento ${mapping.jsonPath}: ${e.message}`, sender: 'bot' }]);
                  }
                }
              }
            }
          }
        } catch (error: any) {
          console.error('[TestChatPanel] Erro na chamada API:', error);
          setMessages(prev => [...prev, { id: uuidv4(), text: `Falha ao executar a chamada API: ${error.message}`, sender: 'bot' }]);
        }

        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }

      case 'capability': {
        const capabilityLabel = node.capabilityName || node.title || 'Capacidade MCP';
        setMessages(prev => [...prev, { id: uuidv4(), text: `Executando capacidade: ${capabilityLabel} (simulacao).`, sender: 'bot' }]);

        if (node.capabilityInputJson && node.capabilityInputJson.trim() !== '') {
          const resolvedInput = substituteVariables(node.capabilityInputJson, updatedVarsForNextNode);
          setMessages(prev => [...prev, { id: uuidv4(), text: `Input enviado: ${resolvedInput}`, sender: 'bot' }]);
        }

        const outputSample = node.capabilityContract?.outputSample;
        if (node.capabilityOutputVariable && node.capabilityOutputVariable.trim() !== '') {
          const varName = node.capabilityOutputVariable;
          const outputValue = outputSample ?? {
            status: 'simulado',
            capability: node.capabilityName || node.capabilityId || 'capability'
          };
          updatedVarsForNextNode = { ...updatedVarsForNextNode, [varName]: outputValue };
          setMessages(prev => [...prev, { id: uuidv4(), text: `Variavel "${varName}" definida com resultado simulado.`, sender: 'bot' }]);
        }

        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }

      case 'code-execution': {
        const varName = node.codeOutputVariable;
        if (!node.codeSnippet || !varName) {
          setMessages(prev => [...prev, { id: uuidv4(), text: 'Nó "Executar Código" precisa de um script e de uma variável de saída.', sender: 'bot' }]);
          nextNodeId = findNextNodeId(node.id, 'default');
          break;
        }

        setMessages(prev => [...prev, { id: uuidv4(), text: 'Executando código JavaScript...', sender: 'bot' }]);
        try {
          const response = await fetch('/api/test-code-execution', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ codeSnippet: node.codeSnippet, variables: updatedVarsForNextNode }),
          });
          const payload = await response.json();
          if (!response.ok) {
            throw new Error(payload?.error || 'Falha ao executar código.');
          }
          updatedVarsForNextNode = { ...updatedVarsForNextNode, [varName]: payload.result };
          setMessages(prev => [...prev, {
            id: uuidv4(),
            text: `Código executado e variável "${varName}" atualizada.`,
            sender: 'bot'
          }]);
        } catch (error: any) {
          console.error('[TestChatPanel] Erro ao executar código:', error);
          setMessages(prev => [...prev, { id: uuidv4(), text: `Erro ao executar código: ${error.message}`, sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }

      case 'date-input':
      case 'json-transform':
      case 'file-upload':
      case 'rating-input':
      case 'ai-text-generation':
      case 'intelligent-agent': {
        setMessages(prev => [...prev, { id: uuidv4(), text: `Processando nó: ${node.title || node.type} (simulado)...`, sender: 'bot' }]);
        let variableName: string | undefined = undefined;
        let simulatedValue: any = `[Valor simulado para ${node.title || node.type}]`;

        if (node.type === 'date-input') variableName = node.variableToSaveDate;
        else if (node.type === 'json-transform') variableName = node.jsonOutputVariable;
        else if (node.type === 'file-upload') variableName = node.fileUrlVariable;
        else if (node.type === 'rating-input') variableName = node.ratingOutputVariable;
        else if (node.type === 'ai-text-generation') variableName = node.aiOutputVariable;
        else if (node.type === 'intelligent-agent') variableName = node.agentResponseVariable;

        if (variableName && variableName.trim() !== '') {
          updatedVarsForNextNode = { ...updatedVarsForNextNode, [variableName as string]: simulatedValue };
          setMessages(prev => [...prev, { id: uuidv4(), text: `(Simulado) Variável "${variableName}" definida como: ${JSON.stringify(simulatedValue)}.`, sender: 'bot' }]);
          console.log(`[TestChatPanel] SIMULATED: Variable "${variableName}" set. New temp flowVariables:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }

      case 'typing-emulation':
        setMessages(prev => [...prev, { id: uuidv4(), text: `(Simulando digitação por ${(node.typingDuration || 1500) / 1000}s...)`, sender: 'bot' }]);
        await new Promise(resolve => setTimeout(resolve, node.typingDuration || 1500));
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'log-console':
        const logMsg = substituteVariables(node.logMessage, updatedVarsForNextNode);
        console.log(`[Fluxo de Teste Log]: ${logMsg}`);
        setMessages(prev => [...prev, { id: uuidv4(), text: `(Log no console: ${logMsg})`, sender: 'bot' }]);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'dialogy-send-message': {
        const dialogyContent = substituteVariables(node.dialogyMessageContent, updatedVarsForNextNode);
        if (dialogyContent) {
          setMessages(prev => [
            ...prev,
            { id: uuidv4(), text: `Dialogy (simulado): ${dialogyContent}`, sender: 'bot' },
          ]);
        } else {
          setMessages(prev => [
            ...prev,
            { id: uuidv4(), text: 'Dialogy (simulado): sem conteúdo configurado.', sender: 'bot' },
          ]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }

      case 'redirect':
        setMessages(prev => [...prev, { id: uuidv4(), text: `Simulando redirecionamento para: ${substituteVariables(node.redirectUrl, updatedVarsForNextNode)}`, sender: 'bot' }]);
        autoAdvance = false;
        handleEndChatTest(); // Encerra o teste no redirect
        break;

      case 'end-flow':
        setMessages(prev => [...prev, { id: uuidv4(), text: "Fluxo encerrado.", sender: 'bot' }]);
        autoAdvance = false;
        handleEndChatTest(); // Encerra o teste
        break;

      case 'send-email':
      case 'google-sheets-append':
      case 'media-display':
        const mediaDisplayText = substituteVariables(node.mediaDisplayText, updatedVarsForNextNode);
        setMessages(prev => [...prev, {
          id: uuidv4(),
          text: (
            <div>
              <p>Exibindo Mídia (simulado): {node.mediaDisplayType}</p>
              <p>URL: {substituteVariables(node.mediaDisplayUrl, updatedVarsForNextNode)}</p>
              {mediaDisplayText && <p>Legenda: {mediaDisplayText}</p>}
            </div>
          ),
          sender: 'bot'
        }]);
        if (activeWorkspace?.evolution_api_enabled && node.type === 'media-display') {
          const phoneNumber = activeVars.whatsapp_sender_jid;
          if (phoneNumber) {
            // Logic to send media via WhatsApp, similar to whatsapp-media node
          }
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'time-of-day': {
        let isInTimeRange = false;
        const now = new Date();
        const startTimeStr = node.startTime;
        const endTimeStr = node.endTime;

        if (startTimeStr && endTimeStr) {
          const [startH, startM] = startTimeStr.split(':').map(Number);
          const [endH, endM] = endTimeStr.split(':').map(Number);

          const startDate = new Date();
          startDate.setHours(startH, startM, 0, 0);

          const endDate = new Date();
          endDate.setHours(endH, endM, 0, 0);

          if (endDate < startDate) {
            endDate.setDate(endDate.getDate() + 1);
            if (now < startDate) {
              const nowAdjusted = new Date(now);
              nowAdjusted.setDate(nowAdjusted.getDate() + 1);
              isInTimeRange = nowAdjusted >= startDate && nowAdjusted <= endDate;
            } else {
              isInTimeRange = now >= startDate && now <= endDate;
            }
          } else {
            isInTimeRange = now >= startDate && now <= endDate;
          }
        }
        setMessages(prev => [...prev, { id: uuidv4(), text: `Verificando horário: ${startTimeStr}-${endTimeStr}. Agora: ${now.toLocaleTimeString()}. Resultado: ${isInTimeRange ? "Dentro do Horário" : "Fora do Horário"}.`, sender: 'bot' }]);
        nextNodeId = findNextNodeId(node.id, isInTimeRange ? 'true' : 'false');
        break;
      }

      default:
        setMessages(prev => [...prev, { id: uuidv4(), text: `Tipo de nó "${(node as any).type}" (${(node as any).title || 'Sem título'}) não implementado no chat de teste.`, sender: 'bot' }]);
        autoAdvance = false;
        nextNodeId = null;
        break;
    }

    setFlowVariables(updatedVarsForNextNode);
    activeFlowVariablesRef.current = updatedVarsForNextNode;

    console.log(`[TestChatPanel] processNode EXIT: nodeId: ${node.id}. Vars passed to next step:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
    setIsProcessingNode(false);

    if (autoAdvance && nextNodeId) {
      await processNode(nextNodeId, updatedVarsForNextNode);
    } else if (autoAdvance && !nextNodeId && node.type !== 'end-flow' && node.type !== 'redirect') {
      await processNode(null, updatedVarsForNextNode);
    }
  }, [activeWorkspace, getNodeById, findNextNodeId, substituteVariables, handleEndChatTest, toast, setFlowVariables]);


  const handleStartTest = useCallback(async (triggerNameOverride?: string, initialVarsOverride?: Record<string, any>) => {
    if (!activeWorkspace || activeWorkspace.nodes.length === 0) {
      console.error('[TestChatPanel] Tentativa de iniciar teste sem fluxo ativo ou com fluxo vazio.');
      setMessages([{ id: uuidv4(), text: "Nenhum fluxo ativo ou o fluxo está vazio.", sender: 'bot' }]);
      setIsTesting(false);
      return;
    }
    console.log('[TestChatPanel] handleStartTest iniciado. ID do Workspace:', activeWorkspace.id, 'Qtd. de Nós:', activeWorkspace.nodes.length, 'Trigger Override:', triggerNameOverride, "Initial Vars Override:", initialVarsOverride);

    const initialVars = { ...(initialVarsOverride || {}) };

    setMessages([]);
    setAwaitingInputFor(null);
    setAwaitingInputType('text');
    setIsTesting(true);
    setCurrentNodeId(null);
    setFlowVariables(initialVars);
    activeFlowVariablesRef.current = initialVars;


    const startNode = activeWorkspace.nodes.find(n => n.type === 'start');
    if (startNode) {
      console.log('[TestChatPanel] Nó de início encontrado:', JSON.parse(JSON.stringify(startNode)));

      let actualTriggerName = triggerNameOverride;
      if (!actualTriggerName) {
        if (startNode.triggers && startNode.triggers.length > 0) {
          actualTriggerName = startNode.triggers[0].name;
          console.log(`[TestChatPanel] Usando o primeiro gatilho do nó de início como padrão: "${actualTriggerName}"`);
        } else {
          actualTriggerName = 'default';
          console.log(`[TestChatPanel] Nó de início sem gatilhos, usando saída 'default'.`);
        }
      }

      const varsForFirstNode = { ...initialVars, _triggerName: actualTriggerName };
      await processNode(startNode.id, varsForFirstNode);
    } else {
      console.error('[TestChatPanel] Nenhum nó de início encontrado no fluxo ativo.');
      setMessages([{ id: uuidv4(), text: "Nenhum nó de 'Início do Fluxo' encontrado.", sender: 'bot' }]);
      setIsTesting(false);
    }
  }, [activeWorkspace, processNode, setFlowVariables]);

  const handleRestartTest = useCallback(() => {
    setIsTesting(false);
    setCurrentNodeId(null);
    setAwaitingInputFor(null);
    setAwaitingInputType('text');
    setMessages([]);
    setInputValue('');
    setFlowVariables({});
    activeFlowVariablesRef.current = {};
    setIsProcessingNode(false);
    setCurrentOptions([]);
  }, []);

  const handleOptionClick = useCallback(async (option: string | { id: string; value: string }) => {
    // Note: checks removed here to allow calling from handleSendMessage
    // if (!awaitingInputFor || awaitingInputType !== 'option' || isProcessingNode) return;

    const optionText = typeof option === 'string' ? option : option.value;
    const optionId = typeof option === 'string' ? option : option.id;

    console.log('[TestChatPanel] handleOptionClick triggered. Option chosen:', optionText, 'ID:', optionId);
    setMessages(prev => [...prev, { id: uuidv4(), text: `Você escolheu: ${optionText}`, sender: 'user' }]);

    let currentVarsSnapshot = { ...activeFlowVariablesRef.current };
    if (awaitingInputFor?.variableToSaveChoice && awaitingInputFor.variableToSaveChoice.trim() !== '') {
      const varName = awaitingInputFor.variableToSaveChoice as string;
      console.log(`[TestChatPanel] Saving choice to variable: ${varName} = ${optionText}`);
      currentVarsSnapshot = { ...currentVarsSnapshot, [varName]: optionText };
    }

    setAwaitingInputFor(null);
    setAwaitingInputType('text');

    setFlowVariables(currentVarsSnapshot);
    activeFlowVariablesRef.current = currentVarsSnapshot;

    // Use ID for routing if available, otherwise text
    let nextNodeIdAfterOption = findNextNodeId(awaitingInputFor?.id || '', optionId);

    // Fallback: checks if there's a connection matching the text if ID failed (legacy support)
    if (!nextNodeIdAfterOption && optionId !== optionText) {
      nextNodeIdAfterOption = findNextNodeId(awaitingInputFor?.id || '', optionText);
    }

    if (!nextNodeIdAfterOption) {
      nextNodeIdAfterOption = findNextNodeId(awaitingInputFor?.id || '', 'default');
    }
    if (!nextNodeIdAfterOption && activeWorkspace) {
      const fallbackConn = activeWorkspace.connections.find(conn => conn.from === awaitingInputFor?.id);
      nextNodeIdAfterOption = fallbackConn?.to || null;
    }
    console.log('[TestChatPanel] nextNodeIdAfterOption found:', nextNodeIdAfterOption);

    processNode(nextNodeIdAfterOption, currentVarsSnapshot);
  }, [awaitingInputFor, awaitingInputType, isProcessingNode, findNextNodeId, processNode, setFlowVariables, activeWorkspace]);

  const handleSendMessage = useCallback(async () => {
    if (inputValue.trim() === '' || !awaitingInputFor || isProcessingNode) {
      return;
    }
    const userMessageText = inputValue.trim();

    // Retrieve fresh node data to ensure we have the latest settings (e.g. aiEnabled toggled during test)
    const freshNode = activeWorkspace?.nodes.find(n => n.id === awaitingInputFor.id) || awaitingInputFor;

    if (awaitingInputType === 'text') {
      console.log('[TestChatPanel] handleSendMessage (Text Input) triggered.');
      setMessages(prev => [...prev, { id: uuidv4(), text: userMessageText, sender: 'user' }]);

      let currentVarsSnapshot = { ...activeFlowVariablesRef.current };
      if (freshNode.variableToSaveResponse && freshNode.variableToSaveResponse.trim() !== '') {
        const varName = freshNode.variableToSaveResponse as string;
        currentVarsSnapshot = { ...currentVarsSnapshot, [varName]: userMessageText };
      }

      setInputValue('');
      setAwaitingInputFor(null);
      setFlowVariables(currentVarsSnapshot);
      activeFlowVariablesRef.current = currentVarsSnapshot;

      const nextNodeIdAfterInput = findNextNodeId(awaitingInputFor.id, 'default');
      processNode(nextNodeIdAfterInput, currentVarsSnapshot);
    }
    else if (awaitingInputType === 'option') {
      console.log('[TestChatPanel] handleSendMessage (Option Input) triggered.');
      // Don't show user message yet, handleOptionClick will do it if successful? 
      // Actually handleOptionClick adds "Você escolheu: ...". 
      // If we type "I want X", we should probably show the user typed matching "X".
      // Let's show the user input first.
      setMessages(prev => [...prev, { id: uuidv4(), text: userMessageText, sender: 'user' }]);
      setInputValue('');

      // 1. Try Number Match (Strict)
      if (/^\d+$/.test(userMessageText)) {
        const indexMatch = parseInt(userMessageText);
        if (!isNaN(indexMatch) && indexMatch >= 1 && indexMatch <= currentOptions.length) {
          await handleOptionClick(currentOptions[indexMatch - 1]);
          return;
        }
      }

      // 2. Try Exact Text Match
      const textMatch = currentOptions.find(opt => {
        const val = typeof opt === 'string' ? opt : opt.value;
        return val.toLowerCase() === userMessageText.toLowerCase();
      });
      if (textMatch) {
        await handleOptionClick(textMatch);
        return;
      }

      // 3. Try AI Match
      if (freshNode.aiEnabled) {
        setMessages(prev => [...prev, { id: uuidv4(), text: "Analisando sua resposta com IA...", sender: 'bot' }]);

        const intents = currentOptions.map(opt => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const id = typeof opt === 'string' ? opt : opt.id;
          return { id, label: val, description: val };
        });

        try {
          const aiResult = await classifyIntent({
            userMessage: userMessageText,
            intents,
            modelName: freshNode.aiModelName
          });

          if (aiResult.matchedIntentId) {
            const matchedOpt = currentOptions.find(opt => (typeof opt === 'string' ? opt : opt.id) === aiResult.matchedIntentId);
            if (matchedOpt) {
              // Remove the "Analyzing..." message? Or just append result.
              setMessages(prev => [...prev, { id: uuidv4(), text: `(IA) Entendi que você quis dizer "${typeof matchedOpt === 'string' ? matchedOpt : matchedOpt.value}".`, sender: 'bot' }]);
              await handleOptionClick(matchedOpt);
              return;
            }
          }
        } catch (err) {
          console.error("AI Classification failed", err);
        }

        setMessages(prev => [...prev, { id: uuidv4(), text: "Não entendi sua escolha. Por favor, tente novamente ou digite o número da opção.", sender: 'bot' }]);
        return;
      }

      setMessages(prev => [...prev, { id: uuidv4(), text: "Opção inválida. Digite o número ou o texto da opção.", sender: 'bot' }]);
    }

  }, [inputValue, awaitingInputFor, awaitingInputType, isProcessingNode, findNextNodeId, processNode, setFlowVariables, handleOptionClick, currentOptions]);


  const handleSimulateWebhookAndStartFlow = useCallback(async () => {
    if (!activeWorkspace) {
      toast({ title: "Erro", description: "Nenhum fluxo ativo para simular webhook.", variant: "destructive" });
      return;
    }
    const startNode = activeWorkspace.nodes.find(n => n.type === 'start');
    if (!startNode) {
      toast({ title: "Erro", description: "Nenhum Nó de Início encontrado no fluxo ativo.", variant: "destructive" });
      return;
    }

    if (!webhookDialogJsonInput.trim()) {
      toast({ title: "Erro", description: "O JSON do webhook simulado não pode estar vazio.", variant: "destructive" });
      return;
    }

    const payloadVarName = "webhook_payload"; // Default
    const messageVarName = "mensagem_whatsapp"; // Default
    const senderJidVarName = "whatsapp_sender_jid"; // Default
    const defaultMessagePath = "data.message.conversation"; // Default

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(webhookDialogJsonInput);
    } catch (error) {
      toast({ title: "Erro no JSON", description: "O JSON do webhook simulado é inválido.", variant: "destructive" });
      return;
    }

    handleRestartTest();

    let initialVars: Record<string, any> = { [payloadVarName]: parsedJson };
    let triggerOverride: string | undefined = undefined;
    const webhookTrigger = startNode.triggers?.find(t => t.type === 'webhook' && t.enabled);
    if (webhookTrigger) {
      triggerOverride = webhookTrigger.name;
      if (Array.isArray(webhookTrigger.variableMappings)) {
        for (const mapping of webhookTrigger.variableMappings) {
          if (mapping.jsonPath && mapping.flowVariable) {
            const value = getProperty(parsedJson, mapping.jsonPath);
            if (value !== undefined) {
              initialVars[mapping.flowVariable.replace(/\{\{|\}\}/g, '').trim()] = value;
            }
          }
        }
      }
    }

    const messageFromJson = getProperty(parsedJson, defaultMessagePath) ||
      getProperty(parsedJson, 'message.body') ||
      getProperty(parsedJson, 'message.textMessage.text') ||
      getProperty(parsedJson, 'text');

    if (messageFromJson !== undefined && messageFromJson !== null) {
      initialVars[messageVarName] = typeof messageFromJson === 'string' ? messageFromJson : JSON.stringify(messageFromJson);
    }

    const senderJidFromJson = getProperty(parsedJson, 'data.key.remoteJid') || getProperty(parsedJson, 'sender');
    if (senderJidFromJson) {
      initialVars[senderJidVarName] = senderJidFromJson;
    }

    setMessages(prev => [
      ...prev,
      {
        id: uuidv4(),
        text: `Webhook simulado recebido. Payload em {{${payloadVarName}}}.${initialVars[messageVarName] ? ` Msg em {{${messageVarName}}}.` : ''}${initialVars[senderJidVarName] ? ` Remetente em {{${senderJidVarName}}}.` : ''} Iniciando fluxo...`,
        sender: 'bot'
      }
    ]);

    setIsSimulateWebhookDialogOpen(false);
    setWebhookDialogJsonInput('');

    if (triggerOverride) {
      initialVars._triggerName = triggerOverride;
    }
    await handleStartTest(triggerOverride, initialVars);

  }, [activeWorkspace, webhookDialogJsonInput, handleRestartTest, handleStartTest, toast]);


  useEffect(() => {
    if (!isTesting) {
      setWebhookDialogJsonInput('');
    }
  }, [isTesting]);

  useEffect(() => {
    handleRestartTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);


  const renderChatInputArea = () => {
    if (!isTesting) {
      return (
        <div className="flex w-full items-center space-x-2">
          <Button onClick={() => handleStartTest(undefined, {})} className="flex-1" disabled={!activeWorkspace || activeWorkspace.nodes.length === 0 || isProcessingNode}>
            <Play className="mr-2 h-4 w-4" /> Iniciar Teste
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsSimulateWebhookDialogOpen(true)}
            title="Simular Webhook Recebido"
            disabled={!activeWorkspace || activeWorkspace.nodes.length === 0 || isProcessingNode}
          >
            <WebhookIcon className="h-4 w-4" />
          </Button>
        </div>
      );
    }

    return (
      <div className="flex w-full items-center space-x-2">
        <Input
          type="text"
          placeholder={awaitingInputType === 'text' ? "Digite sua resposta..." : (awaitingInputType === 'option' ? "Digite o número, texto ou intenção..." : "Aguardando...")}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => { if (e.key === 'Enter' && inputValue.trim() !== '' && !isProcessingNode && (awaitingInputType === 'text' || awaitingInputType === 'option')) handleSendMessage(); }}
          className="flex-1"
          disabled={!isTesting || isProcessingNode || (awaitingInputType !== 'text' && awaitingInputType !== 'option')}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!isTesting || !inputValue.trim() || isProcessingNode || (awaitingInputType !== 'text' && awaitingInputType !== 'option')}
          size="icon"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </Button>
        <Button
          onClick={handleEndChatTest}
          variant="outline"
          size="icon"
          aria-label="Encerrar Teste"
          disabled={isProcessingNode}
          title="Encerrar Teste"
        >
          <LogOut className="h-4 w-4 text-destructive" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSimulateWebhookDialogOpen(true)}
          title="Simular Novo Webhook Recebido (Durante Teste)"
          disabled={isProcessingNode}
        >
          <WebhookIcon className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    );
  };


  return (
    <>
      <Card className="w-[380px] h-full flex flex-col border-l border-border shadow-none rounded-none">
        <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Teste do Fluxo</CardTitle>
          <Button onClick={handleRestartTest} variant="outline" size="sm" disabled={isProcessingNode}>
            {isProcessingNode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {isProcessingNode ? "Processando..." : "Reiniciar"}
          </Button>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <ScrollArea className="h-full p-4" type="always">
            {messages.length === 0 && !isTesting && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Clique em "Iniciar" ou "Simular Webhook" para testar este fluxo.</p>
                {(!activeWorkspace || activeWorkspace.nodes.length === 0) && (
                  <p className="text-sm text-destructive mt-2">Nenhum fluxo ativo ou o fluxo está vazio.</p>
                )}
              </div>
            )}
            {messages.length === 0 && isTesting && currentNodeId && !isProcessingNode && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-muted-foreground">Aguardando a primeira mensagem do fluxo...</p>
              </div>
            )}
            {isProcessingNode && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Loader2 className="w-12 h-12 text-muted-foreground mb-4 animate-spin" />
                <p className="text-muted-foreground">Processando...</p>
              </div>
            )}
            <div className="space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col w-full ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-full p-2.5 rounded-lg text-sm shadow-sm break-words ${msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted text-muted-foreground rounded-bl-none'
                      }`}
                  >
                    {typeof msg.text === 'string' ? formatChatMessage(msg.text) : msg.text}
                  </div>
                  {msg.sender === 'bot' && msg.options && msg.options.length > 0 && awaitingInputType === 'option' && (
                    <div className="mt-2.5 w-full space-y-2">
                      {msg.options.map((opt, index) => {
                        const text = typeof opt === 'string' ? opt : opt.value;
                        return (
                          <button
                            key={index} // Changed from opt to index to avoid duplicate keys if options are identical
                            onClick={() => handleOptionClick(opt)}
                            disabled={isProcessingNode || awaitingInputFor?.type !== 'option'}
                            className="w-full text-left p-3 rounded-lg border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <span className="font-medium">{index + 1}.</span> {text}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {isProcessingNode && messages.length > 0 && currentNodeId && (
                <div className="flex justify-start mt-2 w-full">
                  <div className="max-w-full p-2.5 rounded-lg text-sm shadow-sm bg-muted text-muted-foreground rounded-bl-none flex items-center">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    <span>Bot está digitando...</span>
                  </div>
                </div>
              )}
            </div>
            <div ref={messagesEndRef} />
          </ScrollArea>
        </CardContent>
        <CardFooter className="p-4 border-t">
          {renderChatInputArea()}
        </CardFooter>
      </Card>

      <Dialog open={isSimulateWebhookDialogOpen} onOpenChange={setIsSimulateWebhookDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Simular Webhook Recebido</DialogTitle>
            <DialogDescription>
              Cole o JSON de um webhook da API Evolution. A mensagem e o remetente serão extraídos para as variáveis padrão (`mensagem_whatsapp`, `whatsapp_sender_jid`) e o payload completo para `webhook_payload`. O fluxo começará a partir do primeiro gatilho do Nó de Início.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 gap-2">
              <Label htmlFor="webhook-dialog-json">JSON do Webhook Simulado</Label>
              <Textarea
                id="webhook-dialog-json"
                placeholder='Cole aqui o JSON. Ex: { "data": { "key": {"remoteJid": "55..."}, "message": { "conversation": "Olá!" } } }'
                value={webhookDialogJsonInput}
                onChange={(e) => setWebhookDialogJsonInput(e.target.value)}
                className="min-h-[100px] text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              type="button"
              onClick={handleSimulateWebhookAndStartFlow}
              disabled={!webhookDialogJsonInput.trim()}
            >
              Iniciar Fluxo com Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TestChatPanel;
