
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
import type { WorkspaceData, NodeData } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useToast } from '@/hooks/use-toast';
import { sendWhatsAppMessageAction } from '@/app/actions/evolutionApiActions';


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
  const flowVariablesRef = useRef<Record<string, any>>({}); // Usar ref para acesso síncrono
  const [awaitingInputFor, setAwaitingInputFor] = useState<NodeData | null>(null);
  const [awaitingInputType, setAwaitingInputType] = useState<AwaitingInputType>('text');
  const [isProcessingNode, setIsProcessingNode] = useState(false);

  const [isSimulateWebhookDialogOpen, setIsSimulateWebhookDialogOpen] = useState(false);
  const [selectedWebhookTrigger, setSelectedWebhookTrigger] = useState<string>('');
  const [webhookVariableName, setWebhookVariableName] = useState<string>('webhook_payload');
  const [webhookJsonInput, setWebhookJsonInput] = useState<string>('');
  const [availableStartTriggers, setAvailableStartTriggers] = useState<string[]>([]);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);


  useEffect(() => {
    if (isSimulateWebhookDialogOpen && activeWorkspace) {
      const startNode = activeWorkspace.nodes.find(n => n.type === 'start');
      setAvailableStartTriggers(startNode?.triggers || []);
      if (startNode?.triggers && startNode.triggers.length > 0 && !selectedWebhookTrigger) {
        setSelectedWebhookTrigger(startNode.triggers[0]);
      }
    }
  }, [isSimulateWebhookDialogOpen, activeWorkspace, selectedWebhookTrigger]);
  
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
    let mutableText = String(text);
  
    const variableRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
  
    const substitutedText = mutableText.replace(variableRegex, (match, variableName) => {
      let value: any = currentActiveFlowVariables;
      const parts = variableName.split('.');
      for (const part of parts) {
        if (value && typeof value === 'object' && part in value) {
          value = value[part];
        } else {
          console.warn(`[TestChatPanel] substituteVariables: Part "${part}" of variable "{{${variableName}}}" not found or value is not an object. Vars:`, JSON.parse(JSON.stringify(currentActiveFlowVariables)));
          return match; // Retorna o placeholder original se a variável não for encontrada
        }
      }
  
      if (value === undefined || value === null) {
        console.warn(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" resolved to undefined/null.`);
        return ''; 
      }
      if (typeof value === 'object' || Array.isArray(value)) {
        console.log(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" is object/array, stringifying.`);
        return JSON.stringify(value, null, 2); 
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

  const processNode = useCallback(async (nodeId: string | null, varsForThisExecution: Record<string, any>) => {
    console.log(`[TestChatPanel] processNode ENTER: nodeId: ${nodeId}, varsForThisExecution:`, JSON.parse(JSON.stringify(varsForThisExecution || {})));
    
    setIsProcessingNode(true);
    setCurrentNodeId(nodeId); 
    flowVariablesRef.current = { ...varsForThisExecution }; // Sincroniza a ref com as variáveis atuais

    if (!activeWorkspace) {
        console.error('[TestChatPanel] processNode: activeWorkspace is null or undefined.');
        setMessages(prev => [...prev, { id: uuidv4(), text: "Erro crítico: Fluxo ativo não encontrado.", sender: 'bot' }]);
        handleEndChatTest();
        setIsProcessingNode(false);
        return;
    }

    let activeVars = { ...(varsForThisExecution || {}) };
    console.log(`[TestChatPanel] processNode: effective activeVars for this node:`, JSON.parse(JSON.stringify(activeVars)));

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

    console.log(`[TestChatPanel] Processing node: ${node.id} (${node.type}), Title: ${node.title}. Effective vars for substitution:`, JSON.parse(JSON.stringify(activeVars)));
    
    let nextNodeId: string | null = null;
    let autoAdvance = true;
    let updatedVarsForNextNode = { ...activeVars };

    if (node.type !== 'start' && node.type !== 'delay' && node.type !== 'end-flow') {
        const typingMessageId = uuidv4();
        setMessages(prev => [...prev, { id: typingMessageId, text: "Bot está digitando...", sender: 'bot' }]);
        await new Promise(resolve => setTimeout(resolve, 600));
        setMessages(prev => prev.filter(m => m.id !== typingMessageId));
    }

    switch (node.type) {
      case 'start':
        setMessages(prev => [...prev, { id: uuidv4(), text: `Iniciando fluxo a partir de: ${node.title || 'Nó de Início'} com gatilho específico.`, sender: 'bot' }]);
        const triggerToUse = activeVars._triggerName || (node.triggers && node.triggers.length > 0 ? node.triggers[0] : null);
        
        if (triggerToUse) {
          nextNodeId = findNextNodeId(node.id, triggerToUse);
          if (updatedVarsForNextNode._triggerName) delete updatedVarsForNextNode._triggerName; 
        } else {
          setMessages(prev => [...prev, { id: uuidv4(), text: "Nó de início não tem gatilhos configurados ou conectados.", sender: 'bot' }]);
          autoAdvance = false;
        }
        break;

      case 'message':
        if (node.text) {
          setMessages(prev => [...prev, { id: uuidv4(), text: substituteVariables(node.text, updatedVarsForNextNode), sender: 'bot' }]);
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de mensagem vazio)", sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'input':
        if (node.promptText) {
          setMessages(prev => [...prev, { id: uuidv4(), text: substituteVariables(node.promptText, updatedVarsForNextNode), sender: 'bot' }]);
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de entrada sem pergunta)", sender: 'bot' }]);
        }
        setAwaitingInputFor(node);
        setAwaitingInputType('text');
        autoAdvance = false;
        break;

      case 'option':
        if (node.questionText && node.optionsList) {
          const options = node.optionsList.split('\n').map(opt => opt.trim()).filter(opt => opt);
          setMessages(prev => [...prev, {
            id: uuidv4(),
            text: substituteVariables(node.questionText, updatedVarsForNextNode),
            sender: 'bot',
            options: options
          }]);
          setAwaitingInputFor(node);
          setAwaitingInputType('option');
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de opções mal configurado)", sender: 'bot' }]);
        }
        autoAdvance = false;
        break;

      case 'condition':
        let conditionMet = false;
        const conditionVarField = node.conditionVariable;
        const conditionOperator = node.conditionOperator;
        const conditionCompareValueField = node.conditionValue;

        let actualValue: any;
        let displayVarName = conditionVarField;

        if (conditionVarField) {
            let substitutedVarName = substituteVariables(conditionVarField, updatedVarsForNextNode);
            if (conditionVarField.startsWith("{{") && conditionVarField.endsWith("}}")) {
                const cleanVarName = conditionVarField.substring(2, conditionVarField.length - 2).trim();
                actualValue = updatedVarsForNextNode[cleanVarName];
                displayVarName = cleanVarName; 
            } else {
                 actualValue = updatedVarsForNextNode[conditionVarField];
                 displayVarName = conditionVarField;
                 if (actualValue === undefined) { 
                    actualValue = substitutedVarName;
                 }
            }
        }

        const valueToCompare = conditionCompareValueField
            ? substituteVariables(conditionCompareValueField, updatedVarsForNextNode)
            : undefined;
        
        console.log(`[TestChatPanel] Condition Evaluation: Display Var Name: "${displayVarName}", Actual Value:`, actualValue, `(Type: ${typeof actualValue})`, `Operator: "${conditionOperator}", Value to Compare:`, valueToCompare, `(Type: ${typeof valueToCompare})`);
        setMessages(prev => [...prev, { id: uuidv4(), text: `Avaliando condição: '${displayVarName}' (valor: ${JSON.stringify(actualValue)}) ${conditionOperator} '${valueToCompare === undefined ? 'N/A' : valueToCompare}'`, sender: 'bot' }]);

        switch (conditionOperator) {
            case '==': conditionMet = String(actualValue ?? '') === String(valueToCompare ?? ''); break;
            case '!=': conditionMet = String(actualValue ?? '') !== String(valueToCompare ?? ''); break;
            case '>': conditionMet = Number(actualValue) > Number(valueToCompare); break;
            case '<': conditionMet = Number(actualValue) < Number(valueToCompare); break;
            case 'contains': conditionMet = String(actualValue ?? '').includes(String(valueToCompare ?? '')); break;
            case 'startsWith': conditionMet = String(actualValue ?? '').startsWith(String(valueToCompare ?? '')); break;
            case 'endsWith': conditionMet = String(actualValue ?? '').endsWith(String(valueToCompare ?? '')); break;
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
            updatedVarsForNextNode = {...updatedVarsForNextNode, [node.variableName as string]: valueToSet};
            setMessages(prev => [...prev, { id: uuidv4(), text: `Variável "${node.variableName}" definida como "${valueToSet}".`, sender: 'bot' }]);
            console.log(`[TestChatPanel] Variable Set: ${node.variableName} = ${valueToSet}. New vars for next step:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: `Nó "Definir Variável" sem nome de variável configurado.`, sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      
      case 'whatsapp-text':
      case 'whatsapp-media': {
        setMessages(prev => [...prev, { id: uuidv4(), text: `Tentando enviar mensagem WhatsApp (${node.type})...`, sender: 'bot' }]);
        const isEvolutionApiConfigured = localStorage.getItem('isEvolutionApiEnabled') === 'true';
        const evolutionApiBaseUrl = localStorage.getItem('evolutionApiUrl');
        const evolutionGlobalApiKey = localStorage.getItem('evolutionApiKey');
        const defaultInstanceNameSetting = localStorage.getItem('defaultEvolutionInstanceName');

        const instanceName = substituteVariables(node.instanceName, updatedVarsForNextNode) || defaultInstanceNameSetting || 'evolution_instance';
        const recipientPhoneNumber = substituteVariables(node.phoneNumber, updatedVarsForNextNode);
        
        if (!isEvolutionApiConfigured || !evolutionApiBaseUrl) {
            setMessages(prev => [...prev, { id: uuidv4(), text: "Erro: API Evolution não configurada ou URL base ausente. Verifique as Configurações Globais.", sender: 'bot' }]);
        } else if (!recipientPhoneNumber) {
            setMessages(prev => [...prev, { id: uuidv4(), text: `Erro: Número de telefone do destinatário não fornecido no nó "${node.title}".`, sender: 'bot' }]);
        } else {
            try {
                const result = await sendWhatsAppMessageAction({
                    baseUrl: evolutionApiBaseUrl,
                    apiKey: evolutionGlobalApiKey || undefined,
                    instanceName: instanceName,
                    recipientPhoneNumber: recipientPhoneNumber,
                    messageType: node.type === 'whatsapp-text' ? 'text' : node.mediaType || 'image',
                    textContent: node.type === 'whatsapp-text' ? substituteVariables(node.textMessage, updatedVarsForNextNode) : undefined,
                    mediaUrl: node.type === 'whatsapp-media' ? substituteVariables(node.mediaUrl, updatedVarsForNextNode) : undefined,
                    caption: node.type === 'whatsapp-media' ? substituteVariables(node.caption, updatedVarsForNextNode) : undefined,
                });

                if (result.success) {
                    setMessages(prev => [...prev, { id: uuidv4(), text: `WhatsApp: Mensagem enviada com sucesso para ${recipientPhoneNumber} via instância ${instanceName}.`, sender: 'bot' }]);
                } else {
                    setMessages(prev => [...prev, { id: uuidv4(), text: `WhatsApp: Erro ao enviar mensagem: ${result.error || 'Erro desconhecido'}`, sender: 'bot' }]);
                }
            } catch (error: any) {
                 setMessages(prev => [...prev, { id: uuidv4(), text: `WhatsApp: Exceção ao enviar mensagem: ${error.message}`, sender: 'bot' }]);
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
          autoAdvance = false; break;
        }

        const tableName = substituteVariables(node.supabaseTableName, updatedVarsForNextNode);
        const idColumn = substituteVariables(node.supabaseIdentifierColumn, updatedVarsForNextNode);
        const idValue = substituteVariables(node.supabaseIdentifierValue, updatedVarsForNextNode);
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
                 console.log(`[TestChatPanel] Supabase Read - Querying with filter: table='${tableName}', select='${columnsToSelect}', eq_col='${idColumn}', eq_val='${String(idValue)}'`);
            } else {
                 console.log(`[TestChatPanel] Supabase Read - Querying without filter (all rows): table='${tableName}', select='${columnsToSelect}'`);
            }
            const { data, error } = await query;
            if (error) throw error;
            
            console.log(`[TestChatPanel] Supabase read RAW data for node ${node.id}:`, data);
            
            if (data && data.length > 0) {
                if (data.length === 1) {
                    const singleRow = data[0];
                    const keys = Object.keys(singleRow);
                    if (keys.length === 1 && columnsToSelect && columnsToSelect.trim() !== '*' && !columnsToSelect.includes(',')) {
                        resultDataToSave = singleRow[keys[0]]; // Save only the value
                        setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Valor único lido da tabela '${tableName}', coluna '${keys[0]}': ${resultDataToSave}`, sender: 'bot' }]);
                    } else {
                        resultDataToSave = singleRow; // Save the whole row object
                        setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Dados lidos da tabela '${tableName}': ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
                    }
                } else {
                    resultDataToSave = data; // Save array of rows
                    setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Múltiplas linhas lidas da tabela '${tableName}': ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
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
            const { error, data } = await supabase.from(tableName).delete().eq(idColumn, String(idValue)).select(); 
            if (error) throw error;
            operationSucceeded = true;
            setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Linha(s) deletada(s) da tabela '${tableName}'. Dados afetados: ${JSON.stringify(data, null, 2)}`, sender: 'bot' }]);
          }

          if (operationSucceeded && node.supabaseResultVariable && node.supabaseResultVariable.trim() !== '') {
            const varName = node.supabaseResultVariable as string;
            console.log(`[TestChatPanel] Supabase Op (${node.type}): Attempting to set variable "${varName}" with data:`, JSON.parse(JSON.stringify(resultDataToSave)));
            updatedVarsForNextNode = { ...updatedVarsForNextNode, [varName]: resultDataToSave };
            console.log(`[TestChatPanel] Supabase Op (${node.type}): Variable "${varName}" set. New flowVariables:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
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
          setMessages(prev => [...prev, { id: uuidv4(), text: `(Simulado) Variável "${variableName}" definida como: ${JSON.stringify(simulatedValue)}.`, sender: 'bot'}]);
          console.log(`[TestChatPanel] SIMULATED: Variable "${variableName}" set. New flowVariables:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      }
      
      case 'typing-emulation':
         setMessages(prev => [...prev, { id: uuidv4(), text: `(Simulando digitação por ${ (node.typingDuration || 1500) / 1000}s...)`, sender: 'bot' }]);
         await new Promise(resolve => setTimeout(resolve, node.typingDuration || 1500));
         nextNodeId = findNextNodeId(node.id, 'default');
         break;

      case 'log-console':
        const logMsg = substituteVariables(node.logMessage, updatedVarsForNextNode);
        console.log(`[Fluxo de Teste Log]: ${logMsg}`);
        setMessages(prev => [...prev, {id: uuidv4(), text: `(Log no console: ${logMsg})`, sender: 'bot'}]);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'redirect':
        setMessages(prev => [...prev, { id: uuidv4(), text: `Simulando redirecionamento para: ${substituteVariables(node.redirectUrl, updatedVarsForNextNode)}`, sender: 'bot' }]);
        autoAdvance = false;
        handleEndChatTest(); 
        break;
      
      case 'end-flow':
        setMessages(prev => [...prev, { id: uuidv4(), text: "Fluxo encerrado.", sender: 'bot' }]);
        autoAdvance = false;
        handleEndChatTest();
        break;

      case 'send-email':
      case 'google-sheets-append':
      case 'media-display': 
        setMessages(prev => [...prev, { id: uuidv4(), text: `Simulando ação do nó: ${node.title || node.type}.`, sender: 'bot' }]);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      default:
        setMessages(prev => [...prev, { id: uuidv4(), text: `Tipo de nó "${(node as any).type}" (${(node as any).title || 'Sem título'}) não implementado no chat de teste. Fim da simulação.`, sender: 'bot' }]);
        autoAdvance = false;
        handleEndChatTest();
        break;
    }

    flowVariablesRef.current = { ...updatedVarsForNextNode }; // Atualiza a ref
    console.log(`[TestChatPanel] processNode EXIT: nodeId: ${node.id}, vars passed to next step (or final state):`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));

    setIsProcessingNode(false);
    if (autoAdvance && nextNodeId) {
      await processNode(nextNodeId, updatedVarsForNextNode);
    } else if (autoAdvance && !nextNodeId && node.type !== 'input' && node.type !== 'option' && node.type !== 'redirect' && node.type !== 'end-flow') {
      await processNode(null, updatedVarsForNextNode); 
    }
  }, [activeWorkspace, getNodeById, findNextNodeId, substituteVariables, handleEndChatTest]);

  const handleStartTest = useCallback(async (triggerNameOverride?: string, initialVarsOverride?: Record<string, any>) => {
    if (!activeWorkspace || activeWorkspace.nodes.length === 0) {
      console.error('[TestChatPanel] Tentativa de iniciar teste sem fluxo ativo ou com fluxo vazio.');
      setMessages([{ id: uuidv4(), text: "Nenhum fluxo ativo ou o fluxo está vazio.", sender: 'bot' }]);
      setIsTesting(false);
      return;
    }
    console.log('[TestChatPanel] handleStartTest iniciado. ID do Workspace:', activeWorkspace.id, 'Qtd. de Nós:', activeWorkspace.nodes.length);
    const initialVars = initialVarsOverride || {};
    setMessages([]);
    flowVariablesRef.current = initialVars;
    setAwaitingInputFor(null);
    setAwaitingInputType('text');
    setIsTesting(true);
    setCurrentNodeId(null);

    const startNode = activeWorkspace.nodes.find(n => n.type === 'start');
    if (startNode) {
      console.log('[TestChatPanel] Nó de início encontrado:', JSON.parse(JSON.stringify(startNode)));
      const triggerToUse = triggerNameOverride || (startNode.triggers && startNode.triggers.length > 0 ? startNode.triggers[0] : null);
      if (triggerToUse) {
        await processNode(startNode.id, { ...initialVars, _triggerName: triggerToUse });
      } else {
        setMessages([{ id: uuidv4(), text: "Nó de início não tem gatilhos configurados, ou nenhum gatilho foi especificado para iniciar.", sender: 'bot' }]);
        handleEndChatTest();
      }
    } else {
      console.error('[TestChatPanel] Nenhum nó de início encontrado no fluxo ativo.');
      setMessages([{ id: uuidv4(), text: "Nenhum nó de 'Início do Fluxo' encontrado.", sender: 'bot' }]);
      setIsTesting(false);
    }
  }, [activeWorkspace, processNode, handleEndChatTest]);

  const handleRestartTest = useCallback(() => {
    setIsTesting(false);
    setCurrentNodeId(null);
    setAwaitingInputFor(null);
    setAwaitingInputType('text');
    setMessages([]);
    setInputValue('');
    flowVariablesRef.current = {};
    setIsProcessingNode(false);
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (inputValue.trim() === '' || !awaitingInputFor || awaitingInputType !== 'text' || isProcessingNode) {
        return;
    }
    console.log('[TestChatPanel] handleSendMessage triggered.');
    const userMessageText = inputValue;
    setMessages(prev => [...prev, { id: uuidv4(), text: userMessageText, sender: 'user' }]);

    let updatedVars = { ...flowVariablesRef.current }; 
    console.log('[TestChatPanel] awaitingInputFor (input node):', JSON.parse(JSON.stringify(awaitingInputFor)));
    
    if (awaitingInputFor.variableToSaveResponse && awaitingInputFor.variableToSaveResponse.trim() !== '') {
      const varName = awaitingInputFor.variableToSaveResponse as string;
      console.log(`[TestChatPanel] Saving input to variable: ${varName} = ${userMessageText}`);
      updatedVars = { ...updatedVars, [varName]: userMessageText };
    }
    
    flowVariablesRef.current = updatedVars;
    console.log('[TestChatPanel] flowVariables after input save:', JSON.parse(JSON.stringify(updatedVars)));
    setInputValue('');

    const nextNodeIdAfterInput = findNextNodeId(awaitingInputFor.id, 'default');
    console.log('[TestChatPanel] nextNodeIdAfterInput found:', nextNodeIdAfterInput);
    setAwaitingInputFor(null);
    await processNode(nextNodeIdAfterInput, updatedVars);
  }, [inputValue, awaitingInputFor, awaitingInputType, isProcessingNode, findNextNodeId, processNode]);

  const handleOptionClick = useCallback(async (optionText: string) => {
    if (!awaitingInputFor || awaitingInputType !== 'option' || isProcessingNode) {
      return;
    }
    console.log('[TestChatPanel] handleOptionClick triggered. Option chosen:', optionText);
    setMessages(prev => [...prev, { id: uuidv4(), text: `Você escolheu: ${optionText}`, sender: 'user' }]);

    let updatedVars = { ...flowVariablesRef.current }; 
    if (awaitingInputFor.variableToSaveChoice && awaitingInputFor.variableToSaveChoice.trim() !== '') {
      const varName = awaitingInputFor.variableToSaveChoice as string;
      console.log(`[TestChatPanel] Saving choice to variable: ${varName} = ${optionText}`);
      updatedVars = { ...updatedVars, [varName]: optionText };
    }
    
    flowVariablesRef.current = updatedVars;
    console.log('[TestChatPanel] flowVariables after option save:', JSON.parse(JSON.stringify(updatedVars)));

    const nextNodeIdAfterOption = findNextNodeId(awaitingInputFor.id, optionText);
    console.log('[TestChatPanel] nextNodeIdAfterOption found:', nextNodeIdAfterOption);

    setAwaitingInputFor(null);
    setAwaitingInputType('text'); 
    await processNode(nextNodeIdAfterOption, updatedVars);
  }, [awaitingInputFor, awaitingInputType, isProcessingNode, findNextNodeId, processNode]);


  const handleSimulateWebhookAndStartFlow = useCallback(async () => {
    if (!activeWorkspace) {
      toast({ title: "Erro", description: "Nenhum fluxo ativo para simular webhook.", variant: "destructive" });
      return;
    }
    if (!selectedWebhookTrigger) {
      toast({ title: "Erro", description: "Selecione um gatilho de início.", variant: "destructive" });
      return;
    }
    if (!webhookJsonInput.trim()) {
      toast({ title: "Erro", description: "O JSON do webhook simulado não pode estar vazio.", variant: "destructive" });
      return;
    }
    if (!webhookVariableName.trim()) {
      toast({ title: "Erro", description: "O nome da variável para salvar o JSON não pode estar vazio.", variant: "destructive" });
      return;
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(webhookJsonInput);
    } catch (error) {
      toast({ title: "Erro no JSON", description: "O JSON do webhook simulado é inválido.", variant: "destructive" });
      return;
    }

    handleRestartTest(); 
    
    let initialVars = { [webhookVariableName]: parsedJson };
    flowVariablesRef.current = initialVars; // Initialize ref as well

    setMessages(prev => [...prev, { id: uuidv4(), text: `Webhook simulado recebido. Payload salvo em {{${webhookVariableName}}}. Iniciando fluxo a partir do gatilho: "${selectedWebhookTrigger}".`, sender: 'bot' }]);
    setIsTesting(true);
    
    setIsSimulateWebhookDialogOpen(false);
    await handleStartTest(selectedWebhookTrigger, initialVars);

  }, [activeWorkspace, selectedWebhookTrigger, webhookJsonInput, webhookVariableName, handleRestartTest, handleStartTest, toast]);


  useEffect(() => {
    if(!isTesting) {
        setSelectedWebhookTrigger('');
        setWebhookVariableName('webhook_payload');
        setWebhookJsonInput('');
    }
  }, [isTesting]);

  useEffect(() => {
    handleRestartTest();
  }, [activeWorkspace?.id, handleRestartTest]);


  const renderChatInputArea = () => {
    if (!isTesting) {
      return (
        <div className="flex w-full items-center space-x-2">
          <Button onClick={() => handleStartTest()} className="flex-1" disabled={!activeWorkspace || activeWorkspace.nodes.length === 0 || isProcessingNode}>
            <Play className="mr-2 h-4 w-4" /> Iniciar Teste
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setIsSimulateWebhookDialogOpen(true)}
            title="Simular Webhook Recebido"
            disabled={!activeWorkspace || activeWorkspace.nodes.length === 0 || isProcessingNode}
          >
            <WebhookIcon className="h-4 w-4"/>
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
                  className={`max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm break-words ${
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-muted text-muted-foreground rounded-bl-none'
                  }`}
                >
                  {typeof msg.text === 'string' ? msg.text.split('\n').map((line, i) => <p key={i}>{line}</p>) : msg.text}
                </div>
                {msg.sender === 'bot' && msg.options && msg.options.length > 0 && awaitingInputType === 'option' && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.options.map(opt => (
                      <Button
                        key={opt}
                        variant="outline"
                        size="sm"
                        onClick={() => handleOptionClick(opt)}
                        className="bg-background hover:bg-accent hover:text-accent-foreground"
                        disabled={isProcessingNode || awaitingInputFor?.type !== 'option'}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
             {isProcessingNode && messages.length > 0 && currentNodeId && (
                 <div className="flex justify-start mt-2">
                    <div className="max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm bg-muted text-muted-foreground rounded-bl-none flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2"/>
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
                    Inicie o fluxo a partir de um gatilho específico, simulando um webhook recebido.
                </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="webhook-trigger" className="text-right">
                        Gatilho de Início
                    </Label>
                    <Select 
                        value={selectedWebhookTrigger} 
                        onValueChange={setSelectedWebhookTrigger}
                        disabled={availableStartTriggers.length === 0}
                    >
                        <SelectTrigger id="webhook-trigger" className="col-span-3">
                            <SelectValue placeholder={availableStartTriggers.length > 0 ? "Selecione um gatilho" : "Nenhum gatilho definido"} />
                        </SelectTrigger>
                        <SelectContent>
                            {availableStartTriggers.map(trigger => (
                                <SelectItem key={trigger} value={trigger}>{trigger}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {availableStartTriggers.length === 0 && (
                    <p className="col-span-4 text-xs text-destructive text-center">
                        Nenhum gatilho encontrado no nó "Início do Fluxo" do workspace ativo. Adicione gatilhos para usar esta funcionalidade.
                    </p>
                )}
                <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="webhook-variable" className="text-right">
                        Salvar JSON em
                    </Label>
                    <Input
                        id="webhook-variable"
                        value={webhookVariableName}
                        onChange={(e) => setWebhookVariableName(e.target.value)}
                        className="col-span-3"
                        placeholder="ex: webhook_payload"
                    />
                </div>
                <div className="grid grid-cols-1 gap-2">
                     <Label htmlFor="webhook-json">JSON do Webhook Simulado</Label>
                    <Textarea
                        id="webhook-json"
                        placeholder='Cole aqui o JSON. Ex: { "event": "newMessage", "message": { "text": "Olá!" } }'
                        value={webhookJsonInput}
                        onChange={(e) => setWebhookJsonInput(e.target.value)}
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
                    disabled={availableStartTriggers.length === 0 || !selectedWebhookTrigger || !webhookJsonInput.trim() || !webhookVariableName.trim()}
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
    