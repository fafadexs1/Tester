
'use client';

import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarInset,
  SidebarProvider,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  ChevronDown
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import type { Organization } from '@/lib/types';
import { getOrganizationsForUserAction, createOrganizationAction } from '@/app/actions/organizationActions';
import { ChevronsUpDown, Workflow, BarChart2, Building, Users, CreditCard, ScrollText, Settings, LogOut, Zap, LifeBuoy, Loader2, PlusCircle, Mail, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MainNav = () => {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Link href="/" passHref>
          <SidebarMenuButton isActive={isActive('/')} tooltip="Fluxos de Trabalho">
            <Workflow />
            <span>Fluxos de Trabalho</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="#" passHref>
          <SidebarMenuButton tooltip="Analytics">
            <BarChart2 />
            <span>Analytics</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};

const OrgNav = () => {
    const pathname = usePathname();
    const { user } = useAuth();
    const [isAccessMenuOpen, setIsAccessMenuOpen] = useState(false);
    
    // Verificação mais precisa para o estado ativo
    const isMembersActive = pathname === '/organization/members';
    const isRolesActive = pathname.startsWith('/organization/members') && pathname.includes('tab=roles');

    useEffect(() => {
        // Abre o menu se uma das suas subpáginas estiver ativa
        if (pathname.startsWith('/organization/members')) {
            setIsAccessMenuOpen(true);
        }
    }, [pathname]);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Configurações da Organização</SidebarGroupLabel>
            <SidebarMenu>
                <SidebarMenuItem>
                    <Link href="/organization/general" passHref>
                        <SidebarMenuButton isActive={pathname === '/organization/general'} tooltip="Geral">
                           <Building />
                           <span>Geral</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => setIsAccessMenuOpen(!isAccessMenuOpen)} className="justify-between">
                       <div className="flex items-center gap-2">
                         <Users />
                         <span>Gerenciar Acesso</span>
                       </div>
                       <ChevronDown className={cn("h-4 w-4 transition-transform", isAccessMenuOpen && "rotate-180")} />
                    </SidebarMenuButton>
                    {isAccessMenuOpen && (
                        <SidebarMenuSub>
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={isMembersActive}>
                                    <Link href="/organization/members">Membros e Times</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                                <SidebarMenuSubButton asChild isActive={isRolesActive}>
                                    <Link href="/organization/members?tab=roles">Cargos e Permissões</Link>
                                </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                        </SidebarMenuSub>
                    )}
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/organization/billing" passHref>
                        <SidebarMenuButton isActive={pathname === '/organization/billing'} tooltip="Billing e Assinatura">
                           <CreditCard />
                           <span>Billing e Assinatura</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/organization/audit" passHref>
                        <SidebarMenuButton isActive={pathname === '/organization/audit'} tooltip="Logs de Auditoria">
                           <ScrollText />
                           <span>Logs de Auditoria</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                {user?.role === 'desenvolvedor' && (
                    <SidebarMenuItem>
                        <Link href="/organization/email" passHref>
                            <SidebarMenuButton isActive={pathname === '/organization/email'} tooltip="E-mail (SMTP)">
                               <Mail />
                               <span>E-mail (SMTP)</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                )}
                 <SidebarMenuItem>
                    <Link href="/organization/integrations" passHref>
                        <SidebarMenuButton isActive={pathname === '/organization/integrations'} tooltip="Integrações">
                           <Settings />
                           <span>Integrações</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
    )
}

const OrganizationSwitcher = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOrgOpen, setIsCreateOrgOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchOrgs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const result = await getOrganizationsForUserAction();
    if (result.success && result.data) {
      setOrganizations(result.data);
    } else {
      toast({
        title: "Erro ao carregar organizações",
        description: result.error || "Não foi possível buscar os dados das suas organizações.",
        variant: "destructive",
      });
    }
    setIsLoading(false);
  }, [user, toast]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleCreateOrgSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const result = await createOrganizationAction(formData);

    if (result.success) {
      toast({ title: "Sucesso!", description: "Nova organização criada." });
      setIsCreateOrgOpen(false);
      await fetchOrgs(); // Refetch organizations to update the list
    } else {
      toast({ title: "Erro ao Criar", description: result.error, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const currentOrg = organizations.find(org => org.id === user?.current_organization_id);

  return (
    <div className="p-2">
       <Dialog open={isCreateOrgOpen} onOpenChange={setIsCreateOrgOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-between" disabled={isLoading}>
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="truncate">Carregando...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={`https://i.pravatar.cc/40?u=${currentOrg?.id || 'org'}`} data-ai-hint="logo organization" />
                    <AvatarFallback>{currentOrg?.name?.slice(0, 2).toUpperCase() || 'OG'}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{currentOrg?.name || 'Selecione a Organização'}</span>
                </div>
              )}
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[var(--sidebar-width)]">
            <DropdownMenuLabel>Suas Organizações</DropdownMenuLabel>
            {organizations.map(org => (
              <DropdownMenuItem key={org.id} onSelect={() => console.log('Mudar para org:', org.id)}>
                <Avatar className="w-5 h-5 mr-2">
                  <AvatarImage src={`https://i.pravatar.cc/40?u=${org.id}`} data-ai-hint="logo organization" />
                  <AvatarFallback>{org.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span>{org.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar nova organização
              </DropdownMenuItem>
            </DialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <DialogContent>
            <form onSubmit={handleCreateOrgSubmit}>
              <DialogHeader>
                  <DialogTitle>Criar Nova Organização</DialogTitle>
                  <DialogDescription>
                      Dê um nome para a sua nova organização.
                  </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                  <Label htmlFor="org-name">Nome da Organização</Label>
                  <Input id="org-name" name="name" required autoFocus />
              </div>
              <DialogFooter>
                  <DialogClose asChild>
                      <Button type="button" variant="outline" disabled={isSubmitting}>Cancelar</Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : 'Criar'}
                  </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  
  const noShellPages = ['/login', '/logout', '/profile', '/admin'];
  const isNoShellPage = noShellPages.some(p => pathname === p) || pathname.startsWith('/flow/');


  if (loading || (!user && !isNoShellPage)) {
     return <div className="flex h-screen w-full items-center justify-center bg-background">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
           </div>;
  }
  
  if (isNoShellPage) {
    return <>{children}</>;
  }
  
  if (!user) {
    return <>{children}</>;
  }
  
  return (
    <SidebarProvider>
        <SidebarPrimitive>
            <SidebarHeader>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="w-7 h-7 text-primary" />
                        <h1 className="text-lg font-semibold">NexusFlow</h1>
                    </div>
                    <SidebarTrigger />
                </div>
                <OrganizationSwitcher />
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <MainNav />
                </SidebarGroup>
                <OrgNav />
            </SidebarContent>
             <SidebarFooter>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="w-full justify-start gap-2">
                             <Avatar className="w-8 h-8">
                                <AvatarImage src="https://i.pravatar.cc/40?u=user" data-ai-hint="user avatar" />
                                <AvatarFallback>{user?.username?.slice(0,2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="truncate text-left">{user?.username || 'Usuário'}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[var(--sidebar-width)] mb-2">
                        <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <Link href="/profile" passHref>
                           <DropdownMenuItem>Perfil</DropdownMenuItem>
                        </Link>
                         <DropdownMenuItem disabled>Configurações</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={logout}>
                            <LogOut className="mr-2 h-4 w-4" />
                            <span>Sair</span>
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarFooter>
        </SidebarPrimitive>
        <SidebarInset>
            {children}
        </SidebarInset>
    </SidebarProvider>
  );
}
