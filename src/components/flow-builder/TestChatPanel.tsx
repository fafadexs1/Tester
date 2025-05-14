
"use client";

import type React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Play, RotateCcw, MessageSquare, Loader2 } from 'lucide-react';
import type { WorkspaceData, NodeData, Connection } from '@/lib/types';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface Message {
  id: string;
  text: string | React.ReactNode;
  sender: 'user' | 'bot';
  options?: string[];
}

interface TestChatPanelProps {
  activeWorkspace: WorkspaceData | null | undefined;
}

const TestChatPanel: React.FC<TestChatPanelProps> = ({ activeWorkspace }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null); 
  const [flowVariables, setFlowVariables] = useState<Record<string, any>>({});
  const [awaitingInputFor, setAwaitingInputFor] = useState<NodeData | null>(null);
  const [isProcessingNode, setIsProcessingNode] = useState(false);
  
  const activeFlowVariablesRef = useRef<Record<string, any>>(flowVariables);
  useEffect(() => {
    activeFlowVariablesRef.current = flowVariables;
  }, [flowVariables]);


  const getNodeById = (nodeId: string): NodeData | undefined => {
    return activeWorkspace?.nodes.find(n => n.id === nodeId);
  };

  const findNextNodeId = (fromNodeId: string, sourceHandle?: string): string | null => {
    console.log(`[TestChatPanel] findNextNodeId: fromNodeId=${fromNodeId}, sourceHandle=${sourceHandle}`);
    const connection = activeWorkspace?.connections.find(
      conn => conn.from === fromNodeId && (conn.sourceHandle === sourceHandle || (!sourceHandle && conn.sourceHandle === 'default'))
    );
    console.log('[TestChatPanel] findNextNodeId: found connection', connection);
    return connection ? connection.to : null;
  };

  const substituteVariables = (text: string | undefined | null, currentActiveFlowVariables: Record<string, any>): string => {
    if (text === undefined || text === null) {
      return '';
    }
    let mutableText = text;
    if (typeof mutableText !== 'string') {
      mutableText = String(mutableText);
    }

    const variableRegex = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

    const substitutedText = mutableText.replace(variableRegex, (match, variableName) => {
      const value = currentActiveFlowVariables[variableName];

      if (value === undefined || value === null) {
        console.log(`[TestChatPanel] substituteVariables: Variable "{{${variableName}}}" is undefined/null.`);
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
  };

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

  const processNode = async (nodeId: string | null, varsForThisExecution: Record<string, any>) => {
    console.log(`[TestChatPanel] processNode ENTER: nodeId: ${nodeId}, receivedVars:`, JSON.parse(JSON.stringify(varsForThisExecution || {})));
    setIsProcessingNode(true);
    setCurrentNodeId(nodeId); 

    if (!activeWorkspace) {
        console.error('[TestChatPanel] processNode: activeWorkspace is null or undefined.');
        setMessages(prev => [...prev, { id: uuidv4(), text: "Erro crítico: Fluxo ativo não encontrado.", sender: 'bot' }]);
        setIsTesting(false);
        setIsProcessingNode(false);
        return;
    }

    let activeVars = { ...(varsForThisExecution || {}) };
    console.log(`[TestChatPanel] processNode: effective activeVars for this node:`, JSON.parse(JSON.stringify(activeVars)));


    if (!nodeId) {
      setMessages(prev => [...prev, { id: uuidv4(), text: "Fim do fluxo.", sender: 'bot' }]);
      setIsTesting(false);
      setAwaitingInputFor(null);
      setIsProcessingNode(false);
      return;
    }

    const node = getNodeById(nodeId);
    if (!node) {
      console.error(`[TestChatPanel] processNode: Node with ID ${nodeId} not found.`);
      setMessages(prev => [...prev, { id: uuidv4(), text: `Erro: Nó com ID ${nodeId} não encontrado. Fim da simulação.`, sender: 'bot' }]);
      setIsTesting(false);
      setAwaitingInputFor(null);
      setIsProcessingNode(false);
      return;
    }

    console.log(`[TestChatPanel] Processing node: ${node.id} (${node.type}), Title: ${node.title}. Effective vars:`, JSON.parse(JSON.stringify(activeVars)));
    
    let nextNodeId: string | null = null;
    let autoAdvance = true;
    let updatedVarsForNextNode = { ...activeVars };

    if (node.type !== 'start' && node.type !== 'delay') {
        const typingMessageId = uuidv4();
        setMessages(prev => [...prev, { id: typingMessageId, text: "Bot está digitando...", sender: 'bot' }]);
        await new Promise(resolve => setTimeout(resolve, 600));
        setMessages(prev => prev.filter(m => m.id !== typingMessageId));
    }

    switch (node.type) {
      case 'start':
        setMessages(prev => [...prev, { id: uuidv4(), text: `Iniciando fluxo a partir de: ${node.title || 'Nó de Início'}`, sender: 'bot' }]);
        if (node.triggers && node.triggers.length > 0 && node.triggers[0]) {
          nextNodeId = findNextNodeId(node.id, node.triggers[0]);
        } else {
          setMessages(prev => [...prev, { id: uuidv4(), text: "Nó de início não tem gatilhos configurados ou conectados.", sender: 'bot' }]);
          autoAdvance = false;
        }
        break;

      case 'message':
        if (node.text) {
          setMessages(prev => [...prev, { id: uuidv4(), text: substituteVariables(node.text, activeVars), sender: 'bot' }]);
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de mensagem vazio)", sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'input':
        if (node.promptText) {
          setMessages(prev => [...prev, { id: uuidv4(), text: substituteVariables(node.promptText, activeVars), sender: 'bot' }]);
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de entrada sem pergunta)", sender: 'bot' }]);
        }
        setAwaitingInputFor(node);
        autoAdvance = false;
        break;

      case 'option':
        if (node.questionText && node.optionsList) {
          const options = node.optionsList.split('\n').map(opt => opt.trim()).filter(opt => opt);
          setMessages(prev => [...prev, {
            id: uuidv4(),
            text: substituteVariables(node.questionText, activeVars),
            sender: 'bot',
            options: options
          }]);
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de opções mal configurado)", sender: 'bot' }]);
             autoAdvance = false;
        }
        setAwaitingInputFor(node);
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
            const substitutedVarField = substituteVariables(conditionVarField, activeVars);
            if (conditionVarField.startsWith("{{") && conditionVarField.endsWith("}}")) {
                const cleanVarName = conditionVarField.substring(2, conditionVarField.length - 2).trim();
                actualValue = activeVars[cleanVarName];
                displayVarName = cleanVarName;
            } else {
                 actualValue = activeVars[conditionVarField] ?? substitutedVarField;
                 displayVarName = conditionVarField;
            }
        }

        const valueToCompare = conditionCompareValueField
            ? substituteVariables(conditionCompareValueField, activeVars)
            : undefined;
        
        console.log(`[TestChatPanel] Condition Evaluation: Display Var Name: "${displayVarName}", Actual Value:`, actualValue, `Operator: "${conditionOperator}", Value to Compare:`, valueToCompare);
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
            const valueToSet = node.variableValue ? substituteVariables(node.variableValue, activeVars) : '';
            updatedVarsForNextNode = {...updatedVarsForNextNode, [node.variableName as string]: valueToSet};
            setMessages(prev => [...prev, { id: uuidv4(), text: `Variável "${node.variableName}" definida como "${valueToSet}".`, sender: 'bot' }]);
            console.log(`[TestChatPanel] Variable Set: ${node.variableName} = ${valueToSet}. Current vars for next step:`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: `Nó "Definir Variável" sem nome de variável configurado.`, sender: 'bot' }]);
        }
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

        const tableName = substituteVariables(node.supabaseTableName, activeVars);
        const idColumn = substituteVariables(node.supabaseIdentifierColumn, activeVars);
        const idValue = substituteVariables(node.supabaseIdentifierValue, activeVars);
        const dataJsonString = substituteVariables(node.supabaseDataJson, activeVars);
        let columnsToSelect = substituteVariables(node.supabaseColumnsToSelect, activeVars).trim();
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
            resultDataToSave = data && data.length > 0 ? data[0] : data; // Retorna primeiro item ou array
            operationSucceeded = true;
            setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Linha criada na tabela '${tableName}'. Resultado: ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
          } else if (node.type === 'supabase-read-row') {
            if (!idColumn || (idValue === undefined || idValue === null || String(idValue).trim() === '')) { throw new Error("Coluna identificadora ou valor não fornecidos para leitura."); }
            const { data, error } = await supabase.from(tableName).select(columnsToSelect).eq(idColumn, String(idValue));
            if (error) throw error;
            
            if (data && data.length > 0) {
              let rowData = data.length === 1 ? data[0] : data;
              if (node.supabaseReturnSingleValue && node.supabaseSingleValueColumn && typeof rowData === 'object' && rowData !== null && node.supabaseSingleValueColumn in rowData) {
                resultDataToSave = rowData[node.supabaseSingleValueColumn];
                setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Valor da coluna '${node.supabaseSingleValueColumn}' lido da tabela '${tableName}': ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
              } else {
                resultDataToSave = rowData;
                setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Dados lidos da tabela '${tableName}': ${JSON.stringify(resultDataToSave, null, 2)}`, sender: 'bot' }]);
              }
            } else {
                setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Nenhum registro encontrado na tabela '${tableName}' com ${idColumn} = '${idValue}'.`, sender: 'bot' }]);
                resultDataToSave = null;
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
            const { error, data } = await supabase.from(tableName).delete().eq(idColumn, String(idValue)).select(); // .select() pode não ser necessário ou útil aqui.
            if (error) throw error;
            operationSucceeded = true;
            setMessages(prev => [...prev, { id: uuidv4(), text: `Supabase: Linha(s) deletada(s) da tabela '${tableName}'. Dados afetados: ${JSON.stringify(data, null, 2)}`, sender: 'bot' }]);
          }

          if (operationSucceeded && node.supabaseResultVariable && node.supabaseResultVariable.trim() !== '') {
            const varName = node.supabaseResultVariable as string;
            console.log(`[TestChatPanel] ${node.type.toUpperCase()}: Attempting to set variable "${varName}" with data:`, JSON.parse(JSON.stringify(resultDataToSave)));
            updatedVarsForNextNode = { ...updatedVarsForNextNode, [varName]: resultDataToSave };
            setMessages(prev => [...prev, { id: uuidv4(), text: `Variável "${varName}" definida.`, sender: 'bot' }]);
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
        const logMsg = substituteVariables(node.logMessage, activeVars);
        console.log(`[Fluxo de Teste Log]: ${logMsg}`);
        setMessages(prev => [...prev, {id: uuidv4(), text: `(Log no console: ${logMsg})`, sender: 'bot'}]);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'redirect':
        setMessages(prev => [...prev, { id: uuidv4(), text: `Simulando redirecionamento para: ${substituteVariables(node.redirectUrl, activeVars)}`, sender: 'bot' }]);
        autoAdvance = false;
        setIsTesting(false);
        setCurrentNodeId(null);
        break;
      case 'send-email':
      case 'google-sheets-append':
      case 'whatsapp-text':
      case 'whatsapp-media':
      case 'whatsapp-group':
      case 'media-display': 
        setMessages(prev => [...prev, { id: uuidv4(), text: `Simulando ação do nó: ${node.title || node.type}.`, sender: 'bot' }]);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      default:
        setMessages(prev => [...prev, { id: uuidv4(), text: `Tipo de nó "${node.type}" (${node.title || 'Sem título'}) não implementado no chat de teste. Fim da simulação.`, sender: 'bot' }]);
        autoAdvance = false;
        setIsTesting(false);
        setAwaitingInputFor(null);
        setCurrentNodeId(null);
        break;
    }

    setFlowVariables(updatedVarsForNextNode);
    activeFlowVariablesRef.current = updatedVarsForNextNode;
    console.log(`[TestChatPanel] processNode EXIT: nodeId: ${node.id}, vars passed to next step (or final state):`, JSON.parse(JSON.stringify(updatedVarsForNextNode)));

    setIsProcessingNode(false);
    if (autoAdvance && nextNodeId) {
      await processNode(nextNodeId, updatedVarsForNextNode);
    } else if (autoAdvance && !nextNodeId && node.type !== 'start' && node.type !== 'input' && node.type !== 'option' && node.type !== 'redirect' ) {
      await processNode(null, updatedVarsForNextNode); 
    }
  };

  const handleStartTest = () => {
    if (!activeWorkspace || activeWorkspace.nodes.length === 0) {
      console.error('[TestChatPanel] Tentativa de iniciar teste sem fluxo ativo ou com fluxo vazio.');
      setMessages([{ id: uuidv4(), text: "Nenhum fluxo ativo ou o fluxo está vazio.", sender: 'bot' }]);
      setIsTesting(false);
      return;
    }
    console.log('[TestChatPanel] handleStartTest iniciado. ID do Workspace:', activeWorkspace.id, 'Qtd. de Nós:', activeWorkspace.nodes.length);
    setMessages([]);
    const initialVars = {};
    setFlowVariables(initialVars); 
    activeFlowVariablesRef.current = initialVars; 
    setAwaitingInputFor(null);
    setIsTesting(true);
    setCurrentNodeId(null);

    const startNode = activeWorkspace.nodes.find(n => n.type === 'start');
    if (startNode) {
      console.log('[TestChatPanel] Nó de início encontrado:', JSON.parse(JSON.stringify(startNode)));
      processNode(startNode.id, initialVars); 
    } else {
      console.error('[TestChatPanel] Nenhum nó de início encontrado no fluxo ativo.');
      setMessages([{ id: uuidv4(), text: "Nenhum nó de 'Início do Fluxo' encontrado.", sender: 'bot' }]);
      setIsTesting(false);
    }
  };

  const handleRestartTest = () => {
    setIsTesting(false);
    setCurrentNodeId(null);
    setAwaitingInputFor(null);
    setMessages([]);
    setInputValue('');
    const initialVars = {};
    setFlowVariables(initialVars);
    activeFlowVariablesRef.current = initialVars;
    setIsProcessingNode(false);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '' || !awaitingInputFor || awaitingInputFor.type !== 'input' || isProcessingNode) {
        return;
    }
    console.log('[TestChatPanel] handleSendMessage triggered.');
    const userMessageText = inputValue;
    setMessages(prev => [...prev, { id: uuidv4(), text: userMessageText, sender: 'user' }]);

    let varsAfterInput = { ...activeFlowVariablesRef.current }; 
    console.log(`[TestChatPanel] awaitingInputFor (input node):`, JSON.parse(JSON.stringify(awaitingInputFor)));
    if (awaitingInputFor.variableToSaveResponse && awaitingInputFor.variableToSaveResponse.trim() !== '') {
      const varName = awaitingInputFor.variableToSaveResponse as string;
      console.log(`[TestChatPanel] Saving input to variable: ${varName} = ${userMessageText}`);
      varsAfterInput = { ...varsAfterInput, [varName]: userMessageText };
    }
    
    console.log('[TestChatPanel] flowVariables after input save:', JSON.parse(JSON.stringify(varsAfterInput)));
    setFlowVariables(varsAfterInput); 
    activeFlowVariablesRef.current = varsAfterInput;
    setInputValue('');

    const nextNodeIdAfterInput = findNextNodeId(awaitingInputFor.id, 'default');
    console.log('[TestChatPanel] nextNodeIdAfterInput found:', nextNodeIdAfterInput);
    setAwaitingInputFor(null);
    await processNode(nextNodeIdAfterInput, varsAfterInput);
  };

  const handleOptionClick = async (optionText: string) => {
    if (!awaitingInputFor || awaitingInputFor.type !== 'option' || isProcessingNode) {
      return;
    }
    console.log('[TestChatPanel] handleOptionClick triggered. Option chosen:', optionText);
    setMessages(prev => [...prev, { id: uuidv4(), text: `Você escolheu: ${optionText}`, sender: 'user' }]);

    let varsAfterOption = { ...activeFlowVariablesRef.current }; 
    if (awaitingInputFor.variableToSaveChoice && awaitingInputFor.variableToSaveChoice.trim() !== '') {
      const varName = awaitingInputFor.variableToSaveChoice as string;
      console.log(`[TestChatPanel] Saving choice to variable: ${varName} = ${optionText}`);
      varsAfterOption = { ...varsAfterOption, [varName]: optionText };
    }
    
    console.log('[TestChatPanel] flowVariables after option save:', JSON.parse(JSON.stringify(varsAfterOption)));
    setFlowVariables(varsAfterOption); 
    activeFlowVariablesRef.current = varsAfterOption;

    const nextNodeIdAfterOption = findNextNodeId(awaitingInputFor.id, optionText);
    console.log('[TestChatPanel] nextNodeIdAfterOption found:', nextNodeIdAfterOption);

    setAwaitingInputFor(null);
    await processNode(nextNodeIdAfterOption, varsAfterOption);
  };


  useEffect(() => {
    handleRestartTest();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkspace?.id]);


  return (
    <Card className="w-[380px] h-full flex flex-col border-l border-border shadow-none rounded-none">
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Teste do Fluxo</CardTitle>
        {!isTesting ? (
          <Button onClick={handleStartTest} size="sm" disabled={!activeWorkspace || activeWorkspace.nodes.length === 0 || isProcessingNode}>
            <Play className="mr-2 h-4 w-4" /> Iniciar
          </Button>
        ) : (
          <Button onClick={handleRestartTest} variant="outline" size="sm" disabled={isProcessingNode}>
             {isProcessingNode ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            {isProcessingNode ? "Processando..." : "Reiniciar"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          {messages.length === 0 && !isTesting && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Clique em "Iniciar" para simular este fluxo.</p>
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
                {msg.sender === 'bot' && msg.options && msg.options.length > 0 && (
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
             {isProcessingNode && messages.length > 0 && (
                 <div className="flex justify-start mt-2">
                    <div className="max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm bg-muted text-muted-foreground rounded-bl-none flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin mr-2"/>
                        <span>Bot está digitando...</span>
                    </div>
                </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        {isTesting ? (
          <div className="flex w-full items-center space-x-2">
            <Input
              type="text"
              placeholder={awaitingInputFor && awaitingInputFor.type === 'input' ? "Digite sua resposta..." : (awaitingInputFor && awaitingInputFor.type === 'option' ? "Escolha uma opção acima..." : "Aguardando...")}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => { if (e.key === 'Enter' && awaitingInputFor && awaitingInputFor.type === 'input' && inputValue.trim() !== '' && !isProcessingNode) handleSendMessage(); }}
              className="flex-1"
              disabled={!isTesting || (awaitingInputFor?.type !== 'input') || isProcessingNode}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!isTesting || !inputValue.trim() || (awaitingInputFor?.type !== 'input') || isProcessingNode}
              size="icon"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
           <Button onClick={handleStartTest} className="w-full" disabled={!activeWorkspace || activeWorkspace.nodes.length === 0 || isProcessingNode}>
            <Play className="mr-2 h-4 w-4" /> Iniciar Teste
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default TestChatPanel;

    
