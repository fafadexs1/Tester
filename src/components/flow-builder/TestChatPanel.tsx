
"use client";

import type React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Send, Play, RotateCcw } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
}

interface TestChatPanelProps {
  // Props para receber dados do fluxo e interagir com a engine de teste no futuro
  // activeWorkspace: WorkspaceData | null; 
}

const TestChatPanel: React.FC<TestChatPanelProps> = (/*{ activeWorkspace }*/) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTesting, setIsTesting] = useState(false);

  const handleSendMessage = () => {
    if (inputValue.trim() === '') return;
    // Lógica para enviar mensagem para a engine do fluxo e receber resposta
    // Por enquanto, apenas adiciona a mensagem do usuário
    setMessages([...messages, { id: Date.now().toString(), text: inputValue, sender: 'user' }]);
    // Simulação de resposta do bot
    setTimeout(() => {
      setMessages(prev => [...prev, {id: (Date.now()+1).toString(), text: `Bot responde a: ${inputValue}`, sender: 'bot'}]);
    }, 500);
    setInputValue('');
  };

  const handleStartTest = () => {
    setMessages([{id: 'initial', text: 'Teste iniciado. Olá!', sender: 'bot'}]);
    setIsTesting(true);
    // Lógica para iniciar a execução do fluxo aqui
    // console.log("Iniciando teste com o fluxo:", activeWorkspace?.name);
  };

  const handleRestartTest = () => {
    setMessages([]);
    setIsTesting(false);
    setInputValue('');
  };

  return (
    <Card className="w-[380px] h-full flex flex-col border-l border-border shadow-none rounded-none">
      <CardHeader className="p-4 border-b">
        <CardTitle className="text-lg">Teste do Fluxo</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full p-4">
          {messages.length === 0 && !isTesting && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Play className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Clique em "Iniciar Teste" para simular este fluxo.</p>
            </div>
          )}
           {messages.length === 0 && isTesting && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-muted-foreground">Aguardando a primeira mensagem do fluxo...</p>
            </div>
          )}
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] p-2.5 rounded-lg text-sm ${
                    msg.sender === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        {!isTesting ? (
          <Button onClick={handleStartTest} className="w-full">
            <Play className="mr-2 h-4 w-4" /> Iniciar Teste
          </Button>
        ) : (
          <div className="flex w-full items-center space-x-2">
            <Button onClick={handleRestartTest} variant="outline" size="icon" aria-label="Reiniciar Teste">
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Input
              type="text"
              placeholder="Digite sua mensagem..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1"
              disabled={messages.length === 0 && isTesting} // Desabilita se o bot ainda não falou
            />
            <Button onClick={handleSendMessage} disabled={!inputValue.trim() || (messages.length === 0 && isTesting)}>
              <Send className="mr-0 md:mr-2 h-4 w-4" />
              <span className="hidden md:inline">Enviar</span>
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default TestChatPanel;
