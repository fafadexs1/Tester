
"use client";

import type React from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Play, RotateCcw, MessageSquare } from 'lucide-react';
import type { WorkspaceData, NodeData, Connection } from '@/lib/types'; // Importar tipos

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

  const substituteVariables = (text: string): string => {
    let substitutedText = text;
    for (const key in flowVariables) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      substitutedText = substitutedText.replace(regex, flowVariables[key]);
    }
    // Remove placeholders não substituídos
    substitutedText = substitutedText.replace(/\{\{[^}]+\}\}/g, ''); 
    return substitutedText;
  };

  const processNode = async (nodeId: string | null) => {
    if (!nodeId) {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: "Fim do fluxo.", sender: 'bot' }]);
      setIsTesting(false);
      setAwaitingInputFor(null);
      return;
    }

    const node = getNodeById(nodeId);
    if (!node) {
      setMessages(prev => [...prev, { id: Date.now().toString(), text: `Erro: Nó com ID ${nodeId} não encontrado.`, sender: 'bot' }]);
      setIsTesting(false);
      setAwaitingInputFor(null);
      return;
    }

    setCurrentNodeId(node.id);
    let nextNodeId: string | null = null;
    let autoAdvance = true;

    switch (node.type) {
      case 'start':
        setMessages(prev => [...prev, { id: Date.now().toString(), text: `Iniciando fluxo a partir de: ${node.title}`, sender: 'bot' }]);
        if (node.triggers && node.triggers.length > 0) {
          // Por simplicidade, pega a primeira conexão do primeiro gatilho
          nextNodeId = findNextNodeId(node.id, node.triggers[0]);
        } else {
          setMessages(prev => [...prev, { id: Date.now().toString(), text: "Nó de início não tem gatilhos configurados ou conectados.", sender: 'bot' }]);
          autoAdvance = false;
        }
        break;
      
      case 'message':
        if (node.text) {
          setMessages(prev => [...prev, { id: Date.now().toString(), text: substituteVariables(node.text), sender: 'bot' }]);
        }
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      case 'input':
        if (node.promptText) {
          setMessages(prev => [...prev, { id: Date.now().toString(), text: substituteVariables(node.promptText), sender: 'bot' }]);
        }
        setAwaitingInputFor(node); // Aguarda entrada do usuário
        autoAdvance = false;
        break;
      
      case 'option':
        if (node.questionText && node.optionsList) {
          const options = node.optionsList.split('\n').map(opt => opt.trim()).filter(opt => opt);
          setMessages(prev => [...prev, { 
            id: Date.now().toString(), 
            text: substituteVariables(node.questionText), 
            sender: 'bot',
            options: options 
          }]);
        }
        setAwaitingInputFor(node); // Aguarda escolha de opção
        autoAdvance = false;
        break;

      // TODO: Implementar lógica para outros tipos de nós
      case 'condition':
        setMessages(prev => [...prev, { id: Date.now().toString(), text: `Nó de Condição "${node.title}" encontrado. Lógica de avaliação pendente. Assumindo caminho 'default' ou 'true' se existir.`, sender: 'bot' }]);
        // Tenta o caminho 'true', depois 'default', depois o primeiro conectado
        nextNodeId = findNextNodeId(node.id, 'true') || findNextNodeId(node.id, 'default') || findNextNodeId(node.id, activeWorkspace?.connections.find(c => c.from === node.id)?.sourceHandle);
        break;
      
      case 'delay':
        const duration = node.delayDuration || 1000;
        setMessages(prev => [...prev, { id: Date.now().toString(), text: `Aguardando ${duration / 1000} segundos...`, sender: 'bot' }]);
        await new Promise(resolve => setTimeout(resolve, duration));
        nextNodeId = findNextNodeId(node.id, 'default');
        break;

      default:
        setMessages(prev => [...prev, { id: Date.now().toString(), text: `Tipo de nó "${node.type}" (${node.title}) não implementado no chat de teste. Tentando avançar...`, sender: 'bot' }]);
        nextNodeId = findNextNodeId(node.id, 'default');
        break;
    }

    if (autoAdvance && nextNodeId) {
      processNode(nextNodeId);
    } else if (autoAdvance && !nextNodeId && node.type !== 'start') { // Se não for nó de início e não houver próximo nó
       processNode(null); // Fim do fluxo
    }
  };

  const handleStartTest = () => {
    if (!activeWorkspace || activeWorkspace.nodes.length === 0) {
      setMessages([{ id: 'error', text: "Nenhum fluxo ativo ou o fluxo está vazio.", sender: 'bot' }]);
      setIsTesting(false);
      return;
    }
    setMessages([]);
    setFlowVariables({});
    setAwaitingInputFor(null);
    setIsTesting(true);
    
    const startNode = activeWorkspace.nodes.find(n => n.type === 'start');
    if (startNode) {
      processNode(startNode.id);
    } else {
      setMessages([{ id: 'error', text: "Nenhum nó de 'Início do Fluxo' encontrado.", sender: 'bot' }]);
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
    // Não inicia automaticamente, usuário deve clicar em "Iniciar Teste"
  };
  
  const handleSendMessage = () => {
    if (inputValue.trim() === '' || !awaitingInputFor || awaitingInputFor.type !== 'input') return;

    const userMessageText = inputValue;
    setMessages(prev => [...prev, { id: Date.now().toString(), text: userMessageText, sender: 'user' }]);
    setInputValue('');

    if (awaitingInputFor.variableToSaveResponse) {
      setFlowVariables(prevVars => ({
        ...prevVars,
        [awaitingInputFor.variableToSaveResponse as string]: userMessageText
      }));
    }
    
    const nextNodeIdAfterInput = findNextNodeId(awaitingInputFor.id, 'default');
    setAwaitingInputFor(null);
    processNode(nextNodeIdAfterInput);
  };

  const handleOptionClick = (optionText: string) => {
    if (!awaitingInputFor || awaitingInputFor.type !== 'option') return;

    setMessages(prev => [...prev, { id: Date.now().toString(), text: `Você escolheu: ${optionText}`, sender: 'user' }]);
    
    if (awaitingInputFor.variableToSaveChoice) {
      setFlowVariables(prevVars => ({
        ...prevVars,
        [awaitingInputFor.variableToSaveChoice as string]: optionText
      }));
    }

    const nextNodeIdAfterOption = findNextNodeId(awaitingInputFor.id, optionText);
    setAwaitingInputFor(null);
    processNode(nextNodeIdAfterOption);
  };


  useEffect(() => { // Reinicia o estado do chat se o workspace mudar
    handleRestartTest();
  }, [activeWorkspace?.id]);


  return (
    <Card className="w-[380px] h-full flex flex-col border-l border-border shadow-none rounded-none">
      <CardHeader className="p-4 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Teste do Fluxo</CardTitle>
        {!isTesting ? (
          <Button onClick={handleStartTest} size="sm">
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
                  className={`max-w-[85%] p-2.5 rounded-lg text-sm shadow-sm ${
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
              onKeyPress={(e) => { if (e.key === 'Enter' && awaitingInputFor && awaitingInputFor.type === 'input') handleSendMessage(); }}
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
