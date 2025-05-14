
"use client";

import type React from 'react';
import { useState, useEffect } from 'react';
import type { WorkspaceData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Save, Undo2, Zap, UserCircle, Settings, LogOut, CreditCard, Database, ChevronDown, PlugZap, BotMessageSquare, Rocket } from 'lucide-react'; // Adicionado Rocket
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// Ícone SVG simples para Supabase (um 'S' estilizado)
const SupabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12.1721 2.00244C12.8801 1.98791 13.576 2.21863 14.1116 2.64953C14.6472 3.08043 14.9816 3.68122 15.0491 4.32663L15.0536 4.43311L15.2402 13.4907C15.2811 14.5963 14.4145 15.5223 13.3045 15.5629C12.9977 15.5745 12.6978 15.5302 12.4233 15.4326L12.1933 15.3496C11.2835 14.9872 10.7389 13.9861 10.9305 13.005L11.9976 7.54346C11.7963 7.44211 11.5823 7.36858 11.3608 7.32471L8.75981 8.00806C7.7488 8.25358 6.85304 7.43087 6.85179 6.39187C6.85091 5.69923 7.32011 5.09048 7.97152 4.89367L8.08993 4.85168L12.0001 3.56348V2.09302C12.0001 2.06352 12.0025 2.03488 12.007 2.00767L12.1721 2.00244ZM12.0001 16.8091L11.9425 16.8323C10.3604 17.5281 8.97375 18.6318 8.06805 20.0061C7.51501 20.8504 7.84881 22.0024 8.78293 22.0024H15.2172C16.1513 22.0024 16.4851 20.8504 15.9321 20.0061C15.0264 18.6318 13.6397 17.5281 12.0577 16.8323L12.0001 16.8091Z"/>
  </svg>
);

// Ícone SVG simples para PostgreSQL (um elefante estilizado ou 'Pg')
const PostgresIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M5.10526 2H18.8947C19.9381 2 20.7895 2.82911 20.7895 3.8421V7.52631H16.6316V14.0526C16.6316 15.3461 15.5772 16.3684 14.2632 16.3684H9.73684C8.42283 16.3684 7.36842 15.3461 7.36842 14.0526V7.52631H3.21053V3.8421C3.21053 2.82911 4.06193 2 5.10526 2ZM12.5789 7.52631H16.6316V3.8421H12.5789V7.52631ZM7.36842 7.52631H11.4211V3.8421H7.36842V7.52631ZM9.73684 17.6316H14.2632C16.3051 17.6316 17.9474 19.2293 17.9474 21.2105C17.9474 21.6453 17.6047 22 17.1579 22H6.84211C6.39526 22 6.05263 21.6453 6.05263 21.2105C6.05263 19.2293 7.69491 17.6316 9.73684 17.6316ZM13.7368 11.2105H10.2632C9.91571 11.2105 9.73684 11.0373 9.73684 10.7895C9.73684 10.5416 9.91571 10.3684 10.2632 10.3684H13.7368C14.0843 10.3684 14.2632 10.5416 14.2632 10.7895C14.2632 11.0373 14.0843 11.2105 13.7368 11.2105Z" />
  </svg>
);

type SettingsCategory = 'database' | 'integrations';

interface TopBarProps {
  workspaces: WorkspaceData[];
  activeWorkspaceId: string | null;
  onAddWorkspace: () => void;
  onSwitchWorkspace: (id: string) => void;
  onSaveWorkspaces: () => void;
  onDiscardChanges: () => void;
  appName?: string;
}

const TopBar: React.FC<TopBarProps> = ({
  workspaces,
  activeWorkspaceId,
  onAddWorkspace,
  onSwitchWorkspace,
  onSaveWorkspaces,
  onDiscardChanges,
  appName = "Flowise Lite"
}) => {
  const { toast } = useToast();
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [activeSettingsCategory, setActiveSettingsCategory] = useState<SettingsCategory>('database');
  
  const [supabaseUrl, setSupabaseUrl] = useState(''); 
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(''); 
  const [isSupabaseEnabled, setIsSupabaseEnabled] = useState(false);

  const [postgresHost, setPostgresHost] = useState('');
  const [postgresPort, setPostgresPort] = useState('');
  const [postgresUser, setPostgresUser] = useState('');
  const [postgresPassword, setPostgresPassword] = useState('');
  const [postgresDatabase, setPostgresDatabase] = useState('');
  const [isPostgresEnabled, setIsPostgresEnabled] = useState(false);

  const [evolutionApiUrl, setEvolutionApiUrl] = useState('');
  const [isEvolutionApiEnabled, setIsEvolutionApiEnabled] = useState(false);


  useEffect(() => {
    const savedSupabaseUrl = localStorage.getItem('supabaseUrl');
    const savedSupabaseAnonKey = localStorage.getItem('supabaseAnonKey');
    const savedIsSupabaseEnabled = localStorage.getItem('isSupabaseEnabled') === 'true';
    
    if (savedSupabaseUrl) setSupabaseUrl(savedSupabaseUrl);
    if (savedSupabaseAnonKey) setSupabaseAnonKey(savedSupabaseAnonKey);
    setIsSupabaseEnabled(savedIsSupabaseEnabled);

    const savedPostgresHost = localStorage.getItem('postgresHost');
    const savedPostgresPort = localStorage.getItem('postgresPort');
    const savedPostgresUser = localStorage.getItem('postgresUser');
    const savedPostgresPassword = localStorage.getItem('postgresPassword');
    const savedPostgresDatabase = localStorage.getItem('postgresDatabase');
    const savedIsPostgresEnabled = localStorage.getItem('isPostgresEnabled') === 'true';

    if (savedPostgresHost) setPostgresHost(savedPostgresHost);
    if (savedPostgresPort) setPostgresPort(savedPostgresPort);
    if (savedPostgresUser) setPostgresUser(savedPostgresUser);
    if (savedPostgresPassword) setPostgresPassword(savedPostgresPassword);
    if (savedPostgresDatabase) setPostgresDatabase(savedPostgresDatabase);
    setIsPostgresEnabled(savedIsPostgresEnabled);

    const savedEvolutionApiUrl = localStorage.getItem('evolutionApiUrl');
    const savedIsEvolutionApiEnabled = localStorage.getItem('isEvolutionApiEnabled') === 'true';
    if (savedEvolutionApiUrl) setEvolutionApiUrl(savedEvolutionApiUrl);
    setIsEvolutionApiEnabled(savedIsEvolutionApiEnabled);

  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('supabaseUrl', supabaseUrl);
    localStorage.setItem('supabaseAnonKey', supabaseAnonKey);
    localStorage.setItem('isSupabaseEnabled', String(isSupabaseEnabled));

    localStorage.setItem('postgresHost', postgresHost);
    localStorage.setItem('postgresPort', postgresPort);
    localStorage.setItem('postgresUser', postgresUser);
    localStorage.setItem('postgresPassword', postgresPassword);
    localStorage.setItem('postgresDatabase', postgresDatabase);
    localStorage.setItem('isPostgresEnabled', String(isPostgresEnabled));

    localStorage.setItem('evolutionApiUrl', evolutionApiUrl);
    localStorage.setItem('isEvolutionApiEnabled', String(isEvolutionApiEnabled));

    console.log("Configurações Salvas:", { 
      supabase: { supabaseUrl, supabaseAnonKey, isSupabaseEnabled },
      postgresql: { postgresHost, postgresPort, postgresUser, postgresDatabase, isPostgresEnabled, postgresPasswordExists: postgresPassword.length > 0 },
      evolutionApi: { evolutionApiUrl, isEvolutionApiEnabled }
    });
    toast({
      title: "Configurações Salvas!",
      description: "Suas configurações foram salvas no localStorage.",
    });
    setIsSettingsDialogOpen(false);
  };

  const handlePublishFlow = () => {
    if (!activeWorkspaceId) {
      toast({
        title: "Nenhum fluxo ativo",
        description: "Por favor, selecione um fluxo para publicar.",
        variant: "destructive",
      });
      return;
    }
    const currentWorkspace = workspaces.find(ws => ws.id === activeWorkspaceId);
    toast({
      title: "Publicar Fluxo",
      description: `O fluxo "${currentWorkspace?.name || 'Selecionado'}" seria colocado em produção. (Funcionalidade de placeholder)`,
      variant: "default",
    });
    // Aqui iria a lógica real de publicação
  };

  const settingsCategories: { id: SettingsCategory; label: string; icon: React.ReactNode }[] = [
    { id: 'database', label: 'Banco de Dados', icon: <Database className="w-5 h-5 mr-2" /> },
    { id: 'integrations', label: 'Integrações', icon: <PlugZap className="w-5 h-5 mr-2" /> },
  ];

  return (
    <>
      <header className="flex items-center justify-between h-16 px-4 md:px-6 border-b bg-card text-card-foreground shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold tracking-tight text-primary whitespace-nowrap">{appName}</h1>
          
          {workspaces.length > 0 && activeWorkspaceId && (
            <div className="ml-4 hidden md:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Fluxo:</span>
              <Select
                value={activeWorkspaceId}
                onValueChange={onSwitchWorkspace}
              >
                <SelectTrigger 
                  id="workspace-select-topbar" 
                  className="h-9 w-auto min-w-[150px] max-w-[250px] text-sm"
                  aria-label="Selecionar Fluxo de Trabalho"
                >
                  <SelectValue placeholder="Selecione um fluxo" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id} className="text-sm">
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
           <Button onClick={onAddWorkspace} variant="outline" size="sm" className="ml-2 hidden md:inline-flex">
            <PlusCircle className="mr-2 h-4 w-4" /> Novo Fluxo
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="md:hidden">
            {activeWorkspaceId && workspaces.length > 0 && (
              <Select
                  value={activeWorkspaceId || ""}
                  onValueChange={onSwitchWorkspace}
                >
                  <SelectTrigger 
                    id="workspace-select-topbar-mobile" 
                    className="h-9 w-auto min-w-[calc(100vw-350px)] max-w-[180px] text-sm" // Ajustado o min-width
                    aria-label="Selecionar Fluxo de Trabalho"
                  >
                    <SelectValue placeholder="Selecionar Fluxo" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces.map(ws => (
                      <SelectItem key={ws.id} value={ws.id} className="text-sm">
                        {ws.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            )}
          </div>
           <Button onClick={onAddWorkspace} variant="outline" size="icon" className="ml-1 md:hidden">
            <PlusCircle className="h-4 w-4" />
            <span className="sr-only">Novo Fluxo</span>
          </Button>
          
          <Button 
            onClick={handlePublishFlow} 
            variant="default" 
            size="sm"
            className="bg-teal-600 hover:bg-teal-700 text-white hidden md:inline-flex"
            disabled={!activeWorkspaceId}
          >
            <Rocket className="mr-2 h-4 w-4" /> Publicar
          </Button>
          <Button 
            onClick={handlePublishFlow} 
            variant="default" 
            size="icon"
            className="bg-teal-600 hover:bg-teal-700 text-white md:hidden"
            disabled={!activeWorkspaceId}
            aria-label="Publicar Fluxo"
          >
            <Rocket className="h-4 w-4" />
          </Button>


          <Button 
            onClick={onSaveWorkspaces} 
            variant="outline" // Mudado para outline para diferenciar de Publicar
            size="sm"
            disabled={!activeWorkspaceId}
            className="hidden md:inline-flex"
          >
            <Save className="mr-2 h-4 w-4" /> Salvar
          </Button>
           <Button 
            onClick={onSaveWorkspaces} 
            variant="outline" 
            size="icon"
            disabled={!activeWorkspaceId}
            className="md:hidden"
            aria-label="Salvar Fluxos"
          >
            <Save className="h-4 w-4" />
          </Button>

          <Button 
            onClick={onDiscardChanges} 
            variant="destructive" 
            size="sm"
            disabled={!activeWorkspaceId}
            className="hidden md:inline-flex"
          >
            <Undo2 className="mr-2 h-4 w-4" /> Descartar
          </Button>
          <Button 
            onClick={onDiscardChanges} 
            variant="destructive" 
            size="icon"
            disabled={!activeWorkspaceId}
            className="md:hidden"
            aria-label="Descartar Alterações"
          >
            <Undo2 className="h-4 w-4" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="https://placehold.co/40x40.png?text=UE" alt="@usuarioexemplo" data-ai-hint="user avatar" />
                  <AvatarFallback>UE</AvatarFallback>
                </Avatar>
                <span className="sr-only">Abrir menu do usuário</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <UserCircle className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Assinatura</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setActiveSettingsCategory('database'); setIsSettingsDialogOpen(true); }}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <Dialog open={isSettingsDialogOpen} onOpenChange={setIsSettingsDialogOpen}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-card max-h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <DialogTitle className="text-xl">Configurações da Aplicação</DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-1 overflow-hidden">
            {/* Menu Lateral de Categorias */}
            <aside className="w-1/4 min-w-[200px] border-r bg-muted/40 p-4 space-y-2 overflow-y-auto">
              {settingsCategories.map(category => (
                <Button
                  key={category.id}
                  variant={activeSettingsCategory === category.id ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start text-sm",
                    activeSettingsCategory === category.id ? "font-semibold" : "font-normal"
                  )}
                  onClick={() => setActiveSettingsCategory(category.id)}
                >
                  {category.icon}
                  {category.label}
                </Button>
              ))}
            </aside>

            {/* Conteúdo da Categoria Selecionada */}
            <main className="flex-1 p-6 overflow-y-auto space-y-6">
              {activeSettingsCategory === 'database' && (
                <section>
                  <h3 className="text-lg font-semibold text-card-foreground mb-4">Configurações de Banco de Dados</h3>
                  <Accordion type="multiple" className="w-full space-y-4" defaultValue={['supabase', 'postgresql']}>
                    {/* Configuração Supabase */}
                    <AccordionItem value="supabase" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3">
                          <SupabaseIcon />
                          <span className="font-medium text-card-foreground">Supabase</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch 
                            id="enable-supabase" 
                            checked={isSupabaseEnabled} 
                            onCheckedChange={setIsSupabaseEnabled}
                            aria-label="Habilitar Integração Supabase"
                          />
                          <Label htmlFor="enable-supabase" className="text-sm font-medium">Habilitar Integração Supabase</Label>
                        </div>
                        {isSupabaseEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div>
                              <Label htmlFor="supabase-url" className="text-card-foreground/90 text-sm">URL do Projeto Supabase</Label>
                              <Input
                                id="supabase-url"
                                placeholder="https://seunomeprojeto.supabase.co"
                                value={supabaseUrl}
                                onChange={(e) => setSupabaseUrl(e.target.value)}
                                className="bg-input text-foreground mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="supabase-anon-key" className="text-card-foreground/90 text-sm">Chave Anônima (Anon Key)</Label>
                              <Input
                                id="supabase-anon-key"
                                type="password"
                                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                                value={supabaseAnonKey}
                                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                                className="bg-input text-foreground mt-1"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Usada para acesso público aos dados do seu projeto.
                              </p>
                            </div>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    {/* Configuração PostgreSQL */}
                    <AccordionItem value="postgresql" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3">
                          <PostgresIcon />
                          <span className="font-medium text-card-foreground">PostgreSQL</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch 
                            id="enable-postgres" 
                            checked={isPostgresEnabled} 
                            onCheckedChange={setIsPostgresEnabled}
                            aria-label="Habilitar Integração PostgreSQL"
                          />
                          <Label htmlFor="enable-postgres" className="text-sm font-medium">Habilitar Integração PostgreSQL</Label>
                        </div>
                        {isPostgresEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                                <div>
                                    <Label htmlFor="postgres-host" className="text-card-foreground/90 text-sm">Host</Label>
                                    <Input id="postgres-host" placeholder="localhost" value={postgresHost} onChange={e => setPostgresHost(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="postgres-port" className="text-card-foreground/90 text-sm">Porta</Label>
                                    <Input id="postgres-port" placeholder="5432" value={postgresPort} onChange={e => setPostgresPort(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="postgres-user" className="text-card-foreground/90 text-sm">Usuário</Label>
                                    <Input id="postgres-user" placeholder="seu_usuario" value={postgresUser} onChange={e => setPostgresUser(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                                <div>
                                    <Label htmlFor="postgres-password" className="text-card-foreground/90 text-sm">Senha</Label>
                                    <Input id="postgres-password" type="password" placeholder="********" value={postgresPassword} onChange={e => setPostgresPassword(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                                <div className="md:col-span-2">
                                    <Label htmlFor="postgres-database" className="text-card-foreground/90 text-sm">Nome do Banco</Label>
                                    <Input id="postgres-database" placeholder="nome_do_banco" value={postgresDatabase} onChange={e => setPostgresDatabase(e.target.value)} className="bg-input text-foreground mt-1" />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                As configurações do PostgreSQL são para demonstração e não estão funcionalmente integradas.
                            </p>
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </section>
              )}

              {activeSettingsCategory === 'integrations' && (
                 <section>
                  <h3 className="text-lg font-semibold text-card-foreground mb-4">Configurações de Integrações</h3>
                  <Accordion type="multiple" className="w-full space-y-4" defaultValue={['evolution-api']}>
                    {/* Configuração API Evolution */}
                    <AccordionItem value="evolution-api" className="border rounded-lg shadow-sm">
                      <AccordionTrigger className="px-4 py-3 hover:bg-muted/50 rounded-t-lg">
                        <div className="flex items-center space-x-3">
                          <BotMessageSquare className="w-5 h-5 text-teal-500" />
                          <span className="font-medium text-card-foreground">API Evolution (WhatsApp)</span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pt-3 pb-4 border-t">
                        <div className="flex items-center space-x-2 mb-4">
                          <Switch 
                            id="enable-evolution-api" 
                            checked={isEvolutionApiEnabled} 
                            onCheckedChange={setIsEvolutionApiEnabled}
                            aria-label="Habilitar Integração API Evolution"
                          />
                          <Label htmlFor="enable-evolution-api" className="text-sm font-medium">Habilitar Integração API Evolution</Label>
                        </div>
                        {isEvolutionApiEnabled && (
                          <div className="space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                            <div>
                              <Label htmlFor="evolution-api-url" className="text-card-foreground/90 text-sm">URL do WebSocket da API Evolution</Label>
                              <Input
                                id="evolution-api-url"
                                placeholder="ws://localhost:8080"
                                value={evolutionApiUrl}
                                onChange={(e) => setEvolutionApiUrl(e.target.value)}
                                className="bg-input text-foreground mt-1"
                              />
                              <p className="text-xs text-muted-foreground mt-1">
                                Exemplo: ws://localhost:8080 ou wss://sua-api.com
                              </p>
                            </div>
                            {/* Outros campos para Evolution API podem ser adicionados aqui, como API Key, etc. */}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                    {/* Outras integrações podem ser adicionadas aqui */}
                  </Accordion>
                </section>
              )}
            </main>
          </div>
          
          <DialogFooter className="px-6 py-4 border-t mt-auto">
            <Button variant="outline" onClick={() => setIsSettingsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveSettings}>Salvar Configurações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TopBar;
