
"use client";

import type React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Play, RotateCcw, MessageSquare } from 'lucide-react';
import type { WorkspaceData, NodeData, Connection } from '@/lib/types'; // Importar tipos
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  text: string | React.ReactNode; // Permitir ReactNode para botões de opção
  sender: 'user' | 'bot';
  options?: string[]; // Para nós de Múltipla Escolha
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

  const getNodeById = (nodeId: string): NodeData | undefined => {
    return activeWorkspace?.nodes.find(n => n.id === nodeId);
  };

  const findNextNodeId = (fromNodeId: string, sourceHandle?: string): string | null => {
    console.log(`[TestChatPanel] findNextNodeId: fromNodeId=${fromNodeId}, sourceHandle=${sourceHandle}`);
    console.log('[TestChatPanel] findNextNodeId: activeWorkspace?.connections', activeWorkspace?.connections);
    const connection = activeWorkspace?.connections.find(
      conn => conn.from === fromNodeId && (conn.sourceHandle === sourceHandle || (!sourceHandle && conn.sourceHandle === 'default'))
    );
    console.log('[TestChatPanel] findNextNodeId: found connection', connection);
    return connection ? connection.to : null;
  };

  const substituteVariables = (text: string | undefined | null): string => {
    if (text === undefined || text === null) {
      return '';
    }
    let mutableText = text; 
    if (typeof mutableText !== 'string') {
      mutableText = String(mutableText);
    }
    
    let substitutedText = mutableText;
    for (const key in flowVariables) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      substitutedText = substitutedText.replace(regex, String(flowVariables[key] ?? '')); 
    }
    substitutedText = substitutedText.replace(/\{\{[^}]+\}\}/g, ''); 
    return substitutedText;
  };

  // Helper to simulate saving variable output for various node types
  const simulateVariableSave = (node: NodeData) => {
    let variableName: string | undefined = undefined;
    let simulatedValue: any = `[Valor simulado para ${node.title || node.type}]`;

    switch(node.type) {
      case 'api-call': variableName = node.apiOutputVariable; simulatedValue = { data: "dados da API simulados", status: 200 }; break;
      case 'date-input': variableName = node.variableToSaveDate; simulatedValue = new Date().toISOString().split('T')[0]; break;
      case 'code-execution': variableName = node.codeOutputVariable; simulatedValue = { result: "resultado do código simulado" }; break;
      case 'json-transform': variableName = node.jsonOutputVariable; simulatedValue = { transformed: "JSON transformado simulado" }; break;
      case 'file-upload': variableName = node.fileUrlVariable; simulatedValue = "https://placehold.co/file.txt"; break;
      case 'rating-input': variableName = node.ratingOutputVariable; simulatedValue = Math.floor(Math.random() * (node.maxRatingValue || 5)) + 1; break;
      case 'ai-text-generation': variableName = node.aiOutputVariable; simulatedValue = "Texto gerado por IA simulado."; break;
      case 'intelligent-agent': variableName = node.agentResponseVariable; simulatedValue = "Resposta do agente inteligente simulada."; break;
      case 'supabase-create-row': variableName = node.supabaseResultVariable; simulatedValue = { id: uuidv4(), message: "Linha criada no Supabase (simulado)"}; break;
      case 'supabase-read-row': variableName = node.supabaseResultVariable; simulatedValue = [{ id: node.supabaseIdentifierValue || uuidv4(), data: "Dados lidos do Supabase (simulado)" }]; break;
      // Note: input, option, set-variable are handled more directly upon user interaction or node processing.
    }

    if (variableName && variableName.trim() !== '') {
      setFlowVariables(prev => {
        const newVars = {...prev, [variableName as string]: simulatedValue};
        console.log(`[TestChatPanel] Simulating save for node ${node.id} (${node.type}): ${variableName} =`, simulatedValue, "New flowVariables:", newVars);
        setMessages(prevMessages => [...prevMessages, { id: uuidv4(), text: `(Simulado) Variável "${variableName}" definida como: ${JSON.stringify(simulatedValue)}.`, sender: 'bot'}]);
        return newVars;
      });
    }
  };


  const processNode = async (nodeId: string | null) => {
    console.log('[TestChatPanel] processNode called with nodeId:', nodeId);
    if (!activeWorkspace) {
        console.error('[TestChatPanel] processNode: activeWorkspace is null or undefined.');
        setMessages(prev => [...prev, { id: uuidv4(), text: "Erro crítico: Fluxo ativo não encontrado.", sender: 'bot' }]);
        setIsTesting(false);
        return;
    }

    if (!nodeId) {
      setMessages(prev => [...prev, { id: uuidv4(), text: "Fim do fluxo.", sender: 'bot' }]);
      setIsTesting(false);
      setAwaitingInputFor(null);
      setCurrentNodeId(null);
      return;
    }

    const node = getNodeById(nodeId);
    if (!node) {
      console.error(`[TestChatPanel] processNode: Node with ID ${nodeId} not found.`);
      setMessages(prev => [...prev, { id: uuidv4(), text: `Erro: Nó com ID ${nodeId} não encontrado. Fim da simulação.`, sender: 'bot' }]);
      setIsTesting(false);
      setAwaitingInputFor(null);
      setCurrentNodeId(null);
      return;
    }
    
    console.log('[TestChatPanel] Processing node:', JSON.parse(JSON.stringify(node)));
    console.log('[TestChatPanel] Current flowVariables before processing node:', JSON.parse(JSON.stringify(flowVariables)));
    setCurrentNodeId(node.id);
    let nextNodeId: string | null = null;
    let autoAdvance = true;

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
          setMessages(prev => [...prev, { id: uuidv4(), text: substituteVariables(node.text), sender: 'bot' }]);
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: "(Nó de mensagem vazio)", sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'input':
        if (node.promptText) {
          setMessages(prev => [...prev, { id: uuidv4(), text: substituteVariables(node.promptText), sender: 'bot' }]);
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
            text: substituteVariables(node.questionText), 
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
            if (!conditionVarField.startsWith("{{") && !conditionVarField.endsWith("}}") && flowVariables.hasOwnProperty(conditionVarField)) {
                actualValue = flowVariables[conditionVarField];
                displayVarName = conditionVarField;
            } else {
                const substitutedValue = substituteVariables(conditionVarField);
                if (conditionVarField.startsWith("{{") && conditionVarField.endsWith("}}")) {
                    const cleanVarName = conditionVarField.substring(2, conditionVarField.length - 2).trim();
                    actualValue = flowVariables[cleanVarName]; 
                    displayVarName = cleanVarName;
                } else {
                     actualValue = substitutedValue; 
                     displayVarName = substitutedValue; 
                }
            }
        }

        const valueToCompare = conditionCompareValueField
            ? substituteVariables(conditionCompareValueField)
            : undefined;

        console.log(`[TestChatPanel] Condition Node: Variable Field: "${conditionVarField}", Operator: "${conditionOperator}", Compare Value Field: "${conditionCompareValueField}"`);
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
            const valueToSet = node.variableValue ? substituteVariables(node.variableValue) : '';
            setFlowVariables(prev => ({...prev, [node.variableName as string]: valueToSet}));
            setMessages(prev => [...prev, { id: uuidv4(), text: `Variável "${node.variableName}" definida como "${valueToSet}".`, sender: 'bot' }]);
            console.log(`[TestChatPanel] Variable Set: ${node.variableName} = ${valueToSet}. Current flowVariables:`, JSON.parse(JSON.stringify(flowVariables)));
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: `Nó "Definir Variável" sem nome de variável configurado.`, sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'api-call':
      case 'date-input':
      case 'code-execution':
      case 'json-transform':
      case 'file-upload':
      case 'rating-input':
      case 'ai-text-generation':
      case 'intelligent-agent':
      case 'supabase-create-row':
      case 'supabase-read-row':
        // Simulate processing and saving variable for these node types
        setMessages(prev => [...prev, { id: uuidv4(), text: `Processando nó: ${node.title || node.type} (simulado)...`, sender: 'bot' }]);
        simulateVariableSave(node);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      
      case 'typing-emulation':
         setMessages(prev => [...prev, { id: uuidv4(), text: `(Simulando digitação por ${ (node.typingDuration || 1500) / 1000}s...)`, sender: 'bot' }]);
         await new Promise(resolve => setTimeout(resolve, node.typingDuration || 1500));
         nextNodeId = findNextNodeId(node.id, 'default');
         break;

      case 'log-console':
        const logMsg = substituteVariables(node.logMessage);
        console.log(`[Fluxo de Teste Log]: ${logMsg}`);
        setMessages(prev => [...prev, {id: uuidv4(), text: `(Log no console: ${logMsg})`, sender: 'bot'}]);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      // Nodes that typically end a flow or don't have a default output in simulation
      case 'redirect':
        setMessages(prev => [...prev, { id: uuidv4(), text: `Simulando redirecionamento para: ${substituteVariables(node.redirectUrl)}`, sender: 'bot' }]);
        autoAdvance = false; // End simulation here for redirect
        setIsTesting(false);
        setCurrentNodeId(null);
        break;
      case 'send-email':
      case 'google-sheets-append':
      case 'whatsapp-text':
      case 'whatsapp-media':
      case 'whatsapp-group':
      case 'supabase-update-row':
      case 'supabase-delete-row':
        setMessages(prev => [...prev, { id: uuidv4(), text: `Simulando ação do nó: ${node.title || node.type}.`, sender: 'bot' }]);
        // These nodes might define variables in a real scenario, but for simulation, we mainly acknowledge them.
        // If they had output variables in their NodeData definition, simulateVariableSave could be called.
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      default:
        // Exhaustive check for unhandled node types
        const exhaustiveCheck: never = node.type;
        setMessages(prev => [...prev, { id: uuidv4(), text: `Tipo de nó "${exhaustiveCheck}" (${node.title || 'Sem título'}) não implementado no chat de teste. Fim da simulação.`, sender: 'bot' }]);
        autoAdvance = false; 
        setIsTesting(false);
        setAwaitingInputFor(null);
        setCurrentNodeId(null);
        break;
    }

    if (autoAdvance && nextNodeId) {
      processNode(nextNodeId);
    } else if (autoAdvance && !nextNodeId && node.type !== 'start' && node.type !== 'input' && node.type !== 'option' && node.type !== 'redirect' ) { 
       processNode(null); 
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
    console.log('[TestChatPanel] Workspace nodes:', JSON.stringify(activeWorkspace.nodes, null, 2));
    console.log('[TestChatPanel] Workspace connections:', JSON.stringify(activeWorkspace.connections, null, 2));
    setMessages([]);
    setFlowVariables({});
    setAwaitingInputFor(null);
    setIsTesting(true);
    setCurrentNodeId(null); 
    
    const startNode = activeWorkspace.nodes.find(n => n.type === 'start');
    if (startNode) {
      console.log('[TestChatPanel] Nó de início encontrado:', JSON.parse(JSON.stringify(startNode)));
      processNode(startNode.id);
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
    setFlowVariables({});
  };
  
  const handleSendMessage = () => {
    console.log('[TestChatPanel] handleSendMessage triggered.');
    if (inputValue.trim() === '' || !awaitingInputFor || awaitingInputFor.type !== 'input') {
        console.warn('[TestChatPanel] handleSendMessage: Condition not met.', {inputValue, awaitingInputFor});
        return;
    }
    console.log('[TestChatPanel] awaitingInputFor (input node):', JSON.parse(JSON.stringify(awaitingInputFor)));
    console.log('[TestChatPanel] Current flowVariables before update:', JSON.parse(JSON.stringify(flowVariables)));

    const userMessageText = inputValue;
    setMessages(prev => [...prev, { id: uuidv4(), text: userMessageText, sender: 'user' }]);
    
    if (awaitingInputFor.variableToSaveResponse && awaitingInputFor.variableToSaveResponse.trim() !== '') {
      console.log(`[TestChatPanel] Saving input to variable: ${awaitingInputFor.variableToSaveResponse} = ${userMessageText}`);
      setFlowVariables(prevVars => {
          const newVars = {...prevVars, [awaitingInputFor.variableToSaveResponse as string]: userMessageText };
          console.log('[TestChatPanel] flowVariables after input save:', JSON.parse(JSON.stringify(newVars)));
          return newVars;
      });
    }
    setInputValue(''); 
    
    const nextNodeIdAfterInput = findNextNodeId(awaitingInputFor.id, 'default');
    console.log('[TestChatPanel] nextNodeIdAfterInput found:', nextNodeIdAfterInput);
    setAwaitingInputFor(null);
    processNode(nextNodeIdAfterInput);
  };

  const handleOptionClick = (optionText: string) => {
    console.log('[TestChatPanel] handleOptionClick triggered. Option chosen:', optionText);
    if (!awaitingInputFor || awaitingInputFor.type !== 'option') {
      console.error('[TestChatPanel] handleOptionClick: No awaitingInputFor or not an option node.', { awaitingInputFor });
      return;
    }
    console.log('[TestChatPanel] awaitingInputFor (option node):', JSON.parse(JSON.stringify(awaitingInputFor)));
    console.log('[TestChatPanel] Current flowVariables before update:', JSON.parse(JSON.stringify(flowVariables)));

    setMessages(prev => [...prev, { id: uuidv4(), text: `Você escolheu: ${optionText}`, sender: 'user' }]);
    
    if (awaitingInputFor.variableToSaveChoice && awaitingInputFor.variableToSaveChoice.trim() !== '') {
      console.log(`[TestChatPanel] Saving choice to variable: ${awaitingInputFor.variableToSaveChoice} = ${optionText}`);
      setFlowVariables(prevVars => {
        const newVars = {...prevVars, [awaitingInputFor.variableToSaveChoice as string]: optionText };
        console.log('[TestChatPanel] flowVariables after option save:', JSON.parse(JSON.stringify(newVars)));
        return newVars;
      });
    }

    console.log(`[TestChatPanel] Finding next node from: ${awaitingInputFor.id} with sourceHandle (optionText): "${optionText}"`);
    const nextNodeIdAfterOption = findNextNodeId(awaitingInputFor.id, optionText);
    console.log('[TestChatPanel] nextNodeIdAfterOption found:', nextNodeIdAfterOption);
    
    setAwaitingInputFor(null);
    processNode(nextNodeIdAfterOption);
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
          <Button onClick={handleStartTest} size="sm" disabled={!activeWorkspace || activeWorkspace.nodes.length === 0}>
            <Play className="mr-2 h-4 w-4" /> Iniciar
          </Button>
        ) : (
          <Button onClick={handleRestartTest} variant="outline" size="sm">
            <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar
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
           {messages.length === 0 && isTesting && currentNodeId && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground">Aguardando a primeira mensagem do fluxo...</p>
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
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
              onKeyPress={(e) => { if (e.key === 'Enter' && awaitingInputFor && awaitingInputFor.type === 'input' && inputValue.trim() !== '') handleSendMessage(); }}
              className="flex-1"
              disabled={!isTesting || (awaitingInputFor?.type !== 'input')}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!isTesting || !inputValue.trim() || (awaitingInputFor?.type !== 'input')}
              size="icon"
              aria-label="Enviar"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        ) : (
           <Button onClick={handleStartTest} className="w-full" disabled={!activeWorkspace || activeWorkspace.nodes.length === 0}>
            <Play className="mr-2 h-4 w-4" /> Iniciar Teste
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default TestChatPanel;

    