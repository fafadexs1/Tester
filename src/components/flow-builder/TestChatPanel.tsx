
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
import { getProperty } from 'dot-prop';


interface Message {
  id: string;
  text: string | React.ReactNode;
  sender: 'user' | 'bot';
  options?: string[];
}

type AwaitingInputType = 'text' | 'option';

interface TestChatPanelProps {
  activeWorkspace: WorkspaceData | null | undefined;
}

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
  // const [webhookDialogTriggerName, setWebhookDialogTriggerName] = useState<string>(''); // Removido
  const [webhookDialogJsonInput, setWebhookDialogJsonInput] = useState<string>('');

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const activeFlowVariablesRef = useRef(flowVariables); // Para acesso síncrono em callbacks

  useEffect(() => {
    activeFlowVariablesRef.current = flowVariables;
  }, [flowVariables]);


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const getNodeById = useCallback((nodeId: string): NodeData | undefined => {
    return activeWorkspace?.nodes.find(n => n.id === nodeId);
  }, [activeWorkspace]);

  const findNextNodeId = useCallback((fromNodeId: string, sourceHandle?: string): string | null => {
    console.log(`[TestChatPanel] findNextNodeId: fromNodeId=${fromNodeId}, sourceHandle=${sourceHandle}`);
    const connection = activeWorkspace?.connections.find(
      conn => conn.from === fromNodeId && (conn.sourceHandle === sourceHandle || (!sourceHandle && conn.sourceHandle === 'default'))
    );
    console.log('[TestChatPanel] findNextNodeId: found connection', connection);
    return connection ? connection.to : null;
  }, [activeWorkspace]);

  const substituteVariables = useCallback((text: string | undefined | null, currentActiveFlowVariables: Record<string, any>): string => {
    if (text === undefined || text === null) {
      return '';
    }
    let mutableText = String(text); // Certifica-se de que é uma string
    const variableRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  
    const substitutedText = mutableText.replace(variableRegex, (match, variableName) => {
      // Usar o activeFlowVariablesRef.current para garantir que estamos pegando o valor mais atualizado
      // que foi definido, especialmente importante antes de uma re-renderização do React.
      // No entanto, para a lógica de execução passo a passo, é melhor passar explicitamente.
      let value: any = getProperty(currentActiveFlowVariables, variableName);
      
      if (value === undefined) {
        // Fallback se a variável não for encontrada com dot-prop (ex: nomes simples sem ponto)
        value = currentActiveFlowVariables[variableName];
      }
  
      if (value === undefined || value === null) {
        console.warn(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" resolved to undefined/null. Vars:`, JSON.parse(JSON.stringify(currentActiveFlowVariables)));
        return ''; // Retorna string vazia para evitar "undefined" ou "null" no texto
      }
      if (typeof value === 'object' || Array.isArray(value)) {
        console.log(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" is object/array, stringifying.`);
        try {
          return JSON.stringify(value, null, 2); // Formata o JSON para melhor leitura
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
  
    let activeVars = { ...receivedVars }; // Começa com as variáveis recebidas
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
      setIsProcessingNode(false); // Permite que o usuário clique em "Encerrar" ou "Reiniciar"
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
        // Verificação de envio WhatsApp
        const isEvolutionEnabledGlobally = localStorage.getItem('isEvolutionApiEnabled') === 'true';
        if (isEvolutionEnabledGlobally) {
          const globalPhoneNumber = activeVars.whatsapp_sender_jid || localStorage.getItem('evolutionDefaultTestPhoneNumber'); // Prioriza JID da sessão
          if (globalPhoneNumber) {
            const evolutionApiUrl = localStorage.getItem('evolutionApiBaseUrl');
            const evolutionGlobalApiKey = localStorage.getItem('evolutionApiKey');
            const globalDefaultInstance = localStorage.getItem('defaultEvolutionInstanceName');
            const instanceToUse = node.instanceName || globalDefaultInstance || 'evolution_instance';

            if (evolutionApiUrl && messageText) {
              console.log(`[TestChatPanel] Attempting to send message node text via WhatsApp to ${globalPhoneNumber}`);
              sendWhatsAppMessageAction({
                baseUrl: evolutionApiUrl,
                apiKey: evolutionGlobalApiKey || undefined,
                instanceName: instanceToUse,
                recipientPhoneNumber: globalPhoneNumber,
                messageType: 'text',
                textContent: messageText,
              }).then(result => {
                if (result.success) {
                  setMessages(prev => [...prev, { id: uuidv4(), text: `(Mensagem enviada para ${globalPhoneNumber} via WhatsApp)`, sender: 'bot' }]);
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
           const isEvolutionEnabledGlobally = localStorage.getItem('isEvolutionApiEnabled') === 'true';
            if (isEvolutionEnabledGlobally) {
                const globalPhoneNumber = activeVars.whatsapp_sender_jid || localStorage.getItem('evolutionDefaultTestPhoneNumber');
                 if (globalPhoneNumber) {
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
        if (questionText && node.optionsList) {
          const options = node.optionsList.split('\n').map(opt => substituteVariables(opt.trim(), updatedVarsForNextNode)).filter(opt => opt);
          setMessages(prev => [...prev, {
            id: uuidv4(),
            text: questionText,
            sender: 'bot',
            options: options
          }]);
          const isEvolutionEnabledGlobally = localStorage.getItem('isEvolutionApiEnabled') === 'true';
            if (isEvolutionEnabledGlobally) {
                const globalPhoneNumber = activeVars.whatsapp_sender_jid || localStorage.getItem('evolutionDefaultTestPhoneNumber');
                 if (globalPhoneNumber) {
                    // Lógica similar ao nó 'message' para enviar questionText
                 }
            }
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
            if(actualValue === undefined) actualValue = substituteVariables(conditionVarField, updatedVarsForNextNode); // Fallback se não for placeholder
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
          // setFlowVariables(updatedVarsForNextNode); // O estado global será atualizado ao final do processNode
          setMessages(prev => [...prev, { id: uuidv4(), text: `Variável "${varName}" definida como "${valueToSet}".`, sender: 'bot' }]);
          console.log(`[TestChatPanel] Variable Set: ${varName} = ${valueToSet}. New vars for next step:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
        } else {
          setMessages(prev => [...prev, { id: uuidv4(), text: `Nó "Definir Variável" sem nome de variável configurado.`, sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'whatsapp-text':
      case 'whatsapp-media': {
        const isEvolutionApiEnabledGlobally = localStorage.getItem('isEvolutionApiEnabled') === 'true';
        if (!isEvolutionApiEnabledGlobally) {
            setMessages(prev => [...prev, { id: uuidv4(), text: "Envio WhatsApp pulado: Integração API Evolution não habilitada nas Configurações Globais.", sender: 'bot' }]);
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: `Tentando enviar mensagem WhatsApp (${node.type})...`, sender: 'bot' }]);
            const evolutionApiUrl = localStorage.getItem('evolutionApiBaseUrl');
            const evolutionGlobalApiKey = localStorage.getItem('evolutionApiKey');
            const globalDefaultInstance = localStorage.getItem('defaultEvolutionInstanceName');
            
            const nodeInstanceName = substituteVariables(node.instanceName, updatedVarsForNextNode);
            const instanceNameToUse = nodeInstanceName || globalDefaultInstance || 'evolution_instance';
            
            let recipientPhoneNumber = substituteVariables(node.phoneNumber, updatedVarsForNextNode);
             if (!recipientPhoneNumber && updatedVarsForNextNode.whatsapp_sender_jid) {
                 recipientPhoneNumber = updatedVarsForNextNode.whatsapp_sender_jid;
                 console.log(`[TestChatPanel] WhatsApp: Usando whatsapp_sender_jid (${recipientPhoneNumber}) como destinatário para nó ${node.id}.`);
            }


            if (!evolutionApiUrl) {
                setMessages(prev => [...prev, { id: uuidv4(), text: "Erro: URL base da API Evolution não configurada. Verifique as Configurações Globais.", sender: 'bot' }]);
            } else if (!recipientPhoneNumber) {
                setMessages(prev => [...prev, { id: uuidv4(), text: `Erro: Número de telefone do destinatário não fornecido no nó "${node.title}" nem encontrado em whatsapp_sender_jid.`, sender: 'bot' }]);
            } else {
                try {
                    const result = await sendWhatsAppMessageAction({
                        baseUrl: evolutionApiUrl,
                        apiKey: evolutionGlobalApiKey || undefined,
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
          nextNodeId = null; // Para a execução aqui
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
                    // Se retorna 1 linha e 1 coluna, pega o valor direto
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
            // setFlowVariables(updatedVarsForNextNode); // Deferido para o final de processNode
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

      case 'api-call':
      case 'date-input':
      case 'code-execution':
      case 'json-transform':
      case 'file-upload':
      case 'rating-input':
      case 'ai-text-generation':
      case 'intelligent-agent': {
        setMessages(prev => [...prev, { id: uuidv4(), text: `Processando nó: ${node.title || node.type} (simulado)...`, sender: 'bot' }]);
        let variableName: string | undefined = undefined;
        let simulatedValue: any = `[Valor simulado para ${node.title || node.type}]`;

        if (node.type === 'api-call') variableName = node.apiOutputVariable;
        else if (node.type === 'date-input') variableName = node.variableToSaveDate;
        else if (node.type === 'code-execution') variableName = node.codeOutputVariable;
        else if (node.type === 'json-transform') variableName = node.jsonOutputVariable;
        else if (node.type === 'file-upload') variableName = node.fileUrlVariable;
        else if (node.type === 'rating-input') variableName = node.ratingOutputVariable;
        else if (node.type === 'ai-text-generation') variableName = node.aiOutputVariable;
        else if (node.type === 'intelligent-agent') variableName = node.agentResponseVariable;

        if (variableName && variableName.trim() !== '') {
          updatedVarsForNextNode = { ...updatedVarsForNextNode, [variableName as string]: simulatedValue };
          // setFlowVariables(updatedVarsForNextNode);
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
      case 'media-display': // Media display pode enviar via WhatsApp se configurado
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
         const isEvolutionEnabledForMedia = localStorage.getItem('isEvolutionApiEnabled') === 'true';
          if (isEvolutionEnabledForMedia && node.type === 'media-display') { // Assuming media-display won't have sendViaWhatsApp
            const globalPhoneNumber = activeVars.whatsapp_sender_jid || localStorage.getItem('evolutionDefaultTestPhoneNumber');
            if (globalPhoneNumber) {
              // Logic to send media via WhatsApp, similar to whatsapp-media node
            }
          }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      default:
        setMessages(prev => [...prev, { id: uuidv4(), text: `Tipo de nó "${(node as any).type}" (${(node as any).title || 'Sem título'}) não implementado no chat de teste.`, sender: 'bot' }]);
        // Não encerra o teste aqui, apenas informa e para este caminho
        autoAdvance = false;
        nextNodeId = null; 
        break;
    }

    setFlowVariables(updatedVarsForNextNode); // Atualiza o estado global do React UMA VEZ ao final do processamento do nó
    activeFlowVariablesRef.current = updatedVarsForNextNode; // E a ref síncrona

    console.log(`[TestChatPanel] processNode EXIT: nodeId: ${node.id}. Vars passed to next step:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
    setIsProcessingNode(false);
    
    if (autoAdvance && nextNodeId) {
      await processNode(nextNodeId, updatedVarsForNextNode);
    } else if (autoAdvance && !nextNodeId && node.type !== 'end-flow' && node.type !== 'redirect') {
      // Chegou ao fim de um caminho sem um nó de término explícito
      await processNode(null, updatedVarsForNextNode); // Isso mostrará a mensagem de "Fim do caminho atual"
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
    setCurrentNodeId(null); // Reset current node
    setFlowVariables(initialVars); // Inicia com as vars providas
    activeFlowVariablesRef.current = initialVars;


    const startNode = activeWorkspace.nodes.find(n => n.type === 'start');
    if (startNode) {
      console.log('[TestChatPanel] Nó de início encontrado:', JSON.parse(JSON.stringify(startNode)));
      
      let actualTriggerName = triggerNameOverride;
      if (!actualTriggerName) { // Se nenhum trigger específico foi passado (ex: webhook simulado)
        if (startNode.triggers && startNode.triggers.length > 0) {
          actualTriggerName = startNode.triggers[0].name; // Usa o primeiro trigger como padrão
          console.log(`[TestChatPanel] Usando o primeiro gatilho do nó de início como padrão: "${actualTriggerName}"`);
        } else {
          actualTriggerName = 'default'; // Fallback para saída 'default' se não houver triggers
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
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (inputValue.trim() === '' || !awaitingInputFor || awaitingInputType !== 'text' || isProcessingNode) {
      return;
    }
    console.log('[TestChatPanel] handleSendMessage triggered.');
    const userMessageText = inputValue;
    setMessages(prev => [...prev, { id: uuidv4(), text: userMessageText, sender: 'user' }]);

    let currentVarsSnapshot = { ...activeFlowVariablesRef.current }; 
    console.log('[TestChatPanel] awaitingInputFor (input node):', JSON.parse(JSON.stringify(awaitingInputFor)));

    if (awaitingInputFor.variableToSaveResponse && awaitingInputFor.variableToSaveResponse.trim() !== '') {
      const varName = awaitingInputFor.variableToSaveResponse as string;
      console.log(`[TestChatPanel] Saving input to variable: ${varName} = ${userMessageText}`);
      currentVarsSnapshot = { ...currentVarsSnapshot, [varName]: userMessageText };
    }
    
    setInputValue('');
    setAwaitingInputFor(null); // Limpa o estado de espera
    
    setFlowVariables(currentVarsSnapshot); // Atualiza o estado global
    activeFlowVariablesRef.current = currentVarsSnapshot; // E a ref

    const nextNodeIdAfterInput = findNextNodeId(awaitingInputFor.id, 'default');
    console.log('[TestChatPanel] nextNodeIdAfterInput found:', nextNodeIdAfterInput);
    
    processNode(nextNodeIdAfterInput, currentVarsSnapshot);
  }, [inputValue, awaitingInputFor, awaitingInputType, isProcessingNode, findNextNodeId, processNode, setFlowVariables]);

  const handleOptionClick = useCallback(async (optionText: string) => {
    if (!awaitingInputFor || awaitingInputType !== 'option' || isProcessingNode) {
      return;
    }
    console.log('[TestChatPanel] handleOptionClick triggered. Option chosen:', optionText);
    setMessages(prev => [...prev, { id: uuidv4(), text: `Você escolheu: ${optionText}`, sender: 'user' }]);

    let currentVarsSnapshot = { ...activeFlowVariablesRef.current };
    if (awaitingInputFor.variableToSaveChoice && awaitingInputFor.variableToSaveChoice.trim() !== '') {
      const varName = awaitingInputFor.variableToSaveChoice as string;
      console.log(`[TestChatPanel] Saving choice to variable: ${varName} = ${optionText}`);
      currentVarsSnapshot = { ...currentVarsSnapshot, [varName]: optionText };
    }

    setAwaitingInputFor(null); // Limpa o estado de espera
    setAwaitingInputType('text'); // Reseta para input de texto

    setFlowVariables(currentVarsSnapshot); // Atualiza o estado global
    activeFlowVariablesRef.current = currentVarsSnapshot; // E a ref

    const nextNodeIdAfterOption = findNextNodeId(awaitingInputFor.id, optionText);
    console.log('[TestChatPanel] nextNodeIdAfterOption found:', nextNodeIdAfterOption);

    processNode(nextNodeIdAfterOption, currentVarsSnapshot);
  }, [awaitingInputFor, awaitingInputType, isProcessingNode, findNextNodeId, processNode, setFlowVariables]);


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

    // Reiniciar o teste antes de aplicar novas variáveis e iniciar
    handleRestartTest(); 

    let initialVars: Record<string, any> = { [payloadVarName]: parsedJson };

    // Tenta extrair a mensagem do usuário do JSON colado
    const messageFromJson = getProperty(parsedJson, defaultMessagePath) || 
                            getProperty(parsedJson, 'message.body') || 
                            getProperty(parsedJson, 'message.textMessage.text') ||
                            getProperty(parsedJson, 'text'); // Adiciona fallback para um campo 'text' simples

    if (messageFromJson !== undefined && messageFromJson !== null) {
        initialVars[messageVarName] = typeof messageFromJson === 'string' ? messageFromJson : JSON.stringify(messageFromJson);
    }

    // Tenta extrair o JID do remetente
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
    setWebhookDialogJsonInput(''); // Limpa o input do JSON

    // Inicia o fluxo a partir do primeiro gatilho do nó de início (ou saída 'default')
    await handleStartTest(undefined, initialVars);

  }, [activeWorkspace, webhookDialogJsonInput, handleRestartTest, handleStartTest, toast]);


  useEffect(() => {
    if (!isTesting) {
      setWebhookDialogJsonInput(''); // Limpa o JSON quando não está testando
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
          placeholder={awaitingInputType === 'text' && awaitingInputFor ? "Digite sua resposta..." : (awaitingInputType === 'option' ? "Escolha uma opção acima..." : "Aguardando...")}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => { if (e.key === 'Enter' && awaitingInputType === 'text' && inputValue.trim() !== '' && !isProcessingNode) handleSendMessage(); }}
          className="flex-1"
          disabled={!isTesting || awaitingInputType !== 'text' || isProcessingNode}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!isTesting || !inputValue.trim() || awaitingInputType !== 'text' || isProcessingNode}
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
          <ScrollArea className="h-full p-4">
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
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm break-words ${msg.sender === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-none'
                        : 'bg-muted text-muted-foreground rounded-bl-none'
                      }`}
                  >
                    {typeof msg.text === 'string' ? msg.text.split('\n').map((line, i) => <p key={i}>{line}</p>) : msg.text}
                  </div>
                   {msg.sender === 'bot' && msg.options && msg.options.length > 0 && awaitingInputType === 'option' && (
                    <div className="mt-2.5 w-full space-y-2">
                      {msg.options.map((opt, index) => (
                        <button
                          key={index} // Changed from opt to index to avoid duplicate keys if options are identical
                          onClick={() => handleOptionClick(opt)}
                          disabled={isProcessingNode || awaitingInputFor?.type !== 'option'}
                          className="w-full text-left p-3 rounded-lg border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="font-medium">{index + 1}.</span> {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {isProcessingNode && messages.length > 0 && currentNodeId && (
                <div className="flex justify-start mt-2">
                  <div className="max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm bg-muted text-muted-foreground rounded-bl-none flex items-center">
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
