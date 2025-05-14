
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
  const [awaitingInputFor, setAwaitingInputFor] = useState<NodeData | null>(null); // Para saber qual nó 'input' está esperando

  const getNodeById = (nodeId: string): NodeData | undefined => {
    return activeWorkspace?.nodes.find(n => n.id === nodeId);
  };

  const findNextNodeId = (fromNodeId: string, sourceHandle?: string): string | null => {
    const connection = activeWorkspace?.connections.find(
      conn => conn.from === fromNodeId && (conn.sourceHandle === sourceHandle || (!sourceHandle && conn.sourceHandle === 'default'))
    );
    return connection ? connection.to : null;
  };

  const substituteVariables = (text: string | undefined | null): string => {
    if (text === undefined || text === null) {
      // console.warn('[TestChatPanel] substituteVariables received undefined/null input. Returning empty string.');
      return '';
    }
    let mutableText = text; // Ensure we are working with a mutable variable if text is a string
    if (typeof mutableText !== 'string') {
      console.warn('[TestChatPanel] substituteVariables received non-string input (but not undefined/null):', mutableText, 'Type:', typeof mutableText, '. Converting to string.');
      mutableText = String(mutableText);
    }
    
    let substitutedText = mutableText;
    for (const key in flowVariables) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      substitutedText = substitutedText.replace(regex, String(flowVariables[key] ?? '')); 
    }
    // Remove placeholders não substituídos
    substitutedText = substitutedText.replace(/\{\{[^}]+\}\}/g, ''); 
    return substitutedText;
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
    setCurrentNodeId(node.id);
    let nextNodeId: string | null = null;
    let autoAdvance = true;

    // Simulação de 'typing'
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
             autoAdvance = false; // Parar se mal configurado
        }
        setAwaitingInputFor(node); 
        autoAdvance = false;
        break;
      
      case 'condition':
        let conditionMet = false;
        const conditionVarField = node.conditionVariable; // Nome da variável ou string com {{vars}}, ex: "userInput" ou "{{data.user.age}}"
        const conditionOperator = node.conditionOperator;
        const conditionCompareValueField = node.conditionValue; // Valor literal ou string com {{vars}}

        let actualValue: any;
        let displayVarName = conditionVarField;

        if (conditionVarField) {
            // Primeiro, tentamos interpretar como uma referência de variável direta (sem chaves)
            if (!conditionVarField.startsWith("{{") && !conditionVarField.endsWith("}}") && flowVariables.hasOwnProperty(conditionVarField)) {
                actualValue = flowVariables[conditionVarField];
                displayVarName = conditionVarField;
            } else {
                // Se não for uma chave direta ou tiver chaves, substituímos as variáveis
                const substitutedValue = substituteVariables(conditionVarField);
                // Se o campo original era uma referência {{var}}, tentamos buscar o valor da variável substituída se ela existir
                // Caso contrário, usamos o valor substituído diretamente (pode ser um valor literal após substituição)
                if (conditionVarField.startsWith("{{") && conditionVarField.endsWith("}}")) {
                    const cleanVarName = conditionVarField.substring(2, conditionVarField.length - 2).trim();
                    actualValue = flowVariables[cleanVarName]; // Busca o valor da variável
                    displayVarName = cleanVarName;
                } else {
                     actualValue = substitutedValue; // Usa o resultado da substituição como valor
                     displayVarName = substitutedValue; // Mostra o valor substituído
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
            nextNodeId = findNextNodeId(node.id, 'default'); // Fallback
        }
        break;
      
      case 'delay':
        const duration = node.delayDuration || 1000;
        setMessages(prev => [...prev, { id: uuidv4(), text: `Aguardando ${duration / 1000} segundos...`, sender: 'bot' }]);
        await new Promise(resolve => setTimeout(resolve, duration));
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
      
      case 'set-variable':
        if (node.variableName) {
            const valueToSet = node.variableValue ? substituteVariables(node.variableValue) : '';
            setFlowVariables(prev => ({...prev, [node.variableName as string]: valueToSet}));
            setMessages(prev => [...prev, { id: uuidv4(), text: `Variável "${node.variableName}" definida como "${valueToSet}".`, sender: 'bot' }]);
            console.log(`[TestChatPanel] Variable Set: ${node.variableName} = ${valueToSet}. Current flowVariables:`, JSON.parse(JSON.stringify(flowVariables)));
        } else {
            setMessages(prev => [...prev, { id: uuidv4(), text: `Nó "Definir Variável" sem nome de variável configurado.`, sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      default:
        setMessages(prev => [...prev, { id: uuidv4(), text: `Tipo de nó "${node.type}" (${node.title || 'Sem título'}) não implementado no chat de teste. Fim da simulação.`, sender: 'bot' }]);
        autoAdvance = false; // Para o fluxo
        setIsTesting(false);
        setAwaitingInputFor(null);
        setCurrentNodeId(null);
        break;
    }

    if (autoAdvance && nextNodeId) {
      processNode(nextNodeId);
    } else if (autoAdvance && !nextNodeId && node.type !== 'start' && node.type !== 'input' && node.type !== 'option') { 
       processNode(null); 
    }
  };

  const handleStartTest = () => {
    if (!activeWorkspace || activeWorkspace.nodes.length === 0) {
      console.error('[TestChatPanel] Tentativa de iniciar teste sem fluxo ativo ou com fluxo vazio.');
      setMessages([{ id: 'error-no-workspace', text: "Nenhum fluxo ativo ou o fluxo está vazio.", sender: 'bot' }]);
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
      setMessages([{ id: 'error-no-start-node', text: "Nenhum nó de 'Início do Fluxo' encontrado.", sender: 'bot' }]);
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
    
    if (awaitingInputFor.variableToSaveResponse) {
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
    
    if (awaitingInputFor.variableToSaveChoice) {
      console.log(`[TestChatPanel] Saving choice to variable: ${awaitingInputFor.variableToSaveChoice} = ${optionText}`);
      setFlowVariables(prevVars => {
        const newVars = {...prevVars, [awaitingInputFor.variableToSaveChoice as string]: optionText };
        console.log('[TestChatPanel] flowVariables after option save:', JSON.parse(JSON.stringify(newVars)));
        return newVars;
      });
    }

    console.log(`[TestChatPanel] Finding next node from: ${awaitingInputFor.id} with sourceHandle (optionText): "${optionText}"`);
    console.log('[TestChatPanel] Available connections for active workspace:', JSON.parse(JSON.stringify(activeWorkspace?.connections || [])));
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

