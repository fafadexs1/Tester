
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
  SidebarMenuSubItem,
  SidebarInset,
  SidebarProvider,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarTrigger,
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
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import type { Organization } from '@/lib/types';
import { getOrganizationsForUserAction, createOrganizationAction } from '@/app/actions/organizationActions';
import { ChevronsUpDown, Workflow, BarChart2, Building, Users, CreditCard, ScrollText, Settings, LogOut, Zap, LifeBuoy, Loader2, PlusCircle, Mail, ShieldCheck, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { refreshUserSessionAction } from '@/app/actions/authActions';
import { setCurrentOrganizationForUser } from '@/app/actions/databaseActions';

const MainNav = () => {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  return (
    <SidebarMenu className="space-y-1">
      <SidebarMenuItem>
        <Link href="/" passHref>
          <SidebarMenuButton
            isActive={isActive('/')}
            tooltip="Fluxos de Trabalho"
            className={cn(
              "h-10 transition-all duration-200 hover:bg-white/5 data-[active=true]:bg-violet-600/10 data-[active=true]:text-violet-400 data-[active=true]:hover:bg-violet-600/20",
              isActive('/') && "font-medium"
            )}
          >
            <Workflow className={cn("h-4 w-4", isActive('/') ? "text-violet-400" : "text-zinc-400")} />
            <span>Fluxos de Trabalho</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="/marketplace" passHref>
          <SidebarMenuButton
            isActive={isActive('/marketplace')}
            tooltip="Marketplace"
            className={cn(
              "h-10 transition-all duration-200 hover:bg-white/5 data-[active=true]:bg-violet-600/10 data-[active=true]:text-violet-400 data-[active=true]:hover:bg-violet-600/20",
              isActive('/marketplace') && "font-medium"
            )}
          >
            <Store className={cn("h-4 w-4", isActive('/marketplace') ? "text-violet-400" : "text-zinc-400")} />
            <span>Marketplace</span>
          </SidebarMenuButton>
        </Link>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <Link href="#" passHref>
          <SidebarMenuButton
            tooltip="Analytics"
            className="h-10 transition-all duration-200 hover:bg-white/5 text-zinc-400 hover:text-zinc-100"
          >
            <BarChart2 className="h-4 w-4 text-zinc-400" />
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
  const isMembersActive = pathname.startsWith('/organization/members');
  const isGeneralActive = pathname === '/organization/general';

  useEffect(() => {
    // Abre o menu se uma das suas subpáginas estiver ativa
    if (pathname.startsWith('/organization/members')) {
      setIsAccessMenuOpen(true);
    }
  }, [pathname]);

  const menuItemClass = "h-9 text-sm transition-all duration-200 hover:bg-white/5 data-[active=true]:bg-violet-600/10 data-[active=true]:text-violet-400 data-[active=true]:hover:bg-violet-600/20 text-zinc-400 hover:text-zinc-100";
  const iconClass = (active: boolean) => cn("h-4 w-4", active ? "text-violet-400" : "text-zinc-400");

  return (
    <SidebarGroup className="mt-4">
      <SidebarGroupLabel className="text-xs font-semibold uppercase tracking-wider text-zinc-500 px-2 mb-2">Configurações da Organização</SidebarGroupLabel>
      <SidebarMenu className="space-y-0.5">
        <SidebarMenuItem>
          <Link href="/organization/general" passHref>
            <SidebarMenuButton isActive={isGeneralActive} tooltip="Geral" className={menuItemClass}>
              <Building className={iconClass(isGeneralActive)} />
              <span>Geral</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => setIsAccessMenuOpen(!isAccessMenuOpen)}
            className={cn("justify-between", menuItemClass)}
            isActive={isMembersActive}
          >
            <div className="flex items-center gap-2">
              <Users className={iconClass(isMembersActive)} />
              <span>Gerenciar Acesso</span>
            </div>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform opacity-50", isAccessMenuOpen && "rotate-180")} />
          </SidebarMenuButton>
          {isAccessMenuOpen && (
            <SidebarMenuSub className="border-l-white/10 ml-3.5 pl-2.5">
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  href="/organization/members"
                  isActive={pathname === '/organization/members' && !pathname.includes('?tab=roles')}
                  className="h-8 text-xs hover:bg-white/5 data-[active=true]:text-violet-400"
                >
                  Membros e Times
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  href="/organization/members?tab=roles"
                  isActive={pathname.includes('?tab=roles')}
                  className="h-8 text-xs hover:bg-white/5 data-[active=true]:text-violet-400"
                >
                  Cargos e Permissões
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarMenuSub>
          )}
        </SidebarMenuItem>
        <SidebarMenuItem>
          <Link href="/organization/billing" passHref>
            <SidebarMenuButton isActive={pathname === '/organization/billing'} tooltip="Billing e Assinatura" className={menuItemClass}>
              <CreditCard className={iconClass(pathname === '/organization/billing')} />
              <span>Billing e Assinatura</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <Link href="/organization/audit" passHref>
            <SidebarMenuButton isActive={pathname === '/organization/audit'} tooltip="Logs de Auditoria" className={menuItemClass}>
              <ScrollText className={iconClass(pathname === '/organization/audit')} />
              <span>Logs de Auditoria</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
        {user?.role === 'desenvolvedor' && (
          <SidebarMenuItem>
            <Link href="/organization/email" passHref>
              <SidebarMenuButton isActive={pathname === '/organization/email'} tooltip="E-mail (SMTP)" className={menuItemClass}>
                <Mail className={iconClass(pathname === '/organization/email')} />
                <span>E-mail (SMTP)</span>
              </SidebarMenuButton>
            </Link>
          </SidebarMenuItem>
        )}
        <SidebarMenuItem>
          <Link href="/organization/integrations" passHref>
            <SidebarMenuButton isActive={pathname === '/organization/integrations'} tooltip="Integrações" className={menuItemClass}>
              <Settings className={iconClass(pathname === '/organization/integrations')} />
              <span>Integrações</span>
            </SidebarMenuButton>
          </Link>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  )
}

const OrganizationSwitcher = () => {
  const { user, login } = useAuth(); // Usando login para "re-logar" e atualizar a sessão
  const router = useRouter();
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSwitching, setIsSwitching] = useState(false);
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
      toast({ title: "Sucesso!", description: "Nova organização criada e selecionada." });
      // Força a recarga da página para refletir a nova organização em todos os lugares
      window.location.reload();
    } else {
      toast({ title: "Erro ao Criar", description: result.error, variant: "destructive" });
    }
    setIsSubmitting(false);
  };

  const handleSwitchOrganization = async (orgId: string) => {
    if (!user || orgId === user.current_organization_id) return;

    setIsSwitching(true);
    try {
      await setCurrentOrganizationForUser(user.id, orgId);
      const refreshResult = await refreshUserSessionAction(user.id);
      if (refreshResult.success) {
        toast({ title: "Organização Alterada", description: "Você agora está na nova organização." });
        window.location.reload();
      } else {
        throw new Error(refreshResult.error || "Falha ao atualizar a sessão do usuário.");
      }
    } catch (e: any) {
      toast({ title: "Erro ao trocar de organização", description: e.message, variant: "destructive" });
      setIsSwitching(false);
    }
  };


  const currentOrg = organizations.find(org => org.id === user?.current_organization_id);

  return (
    <div className="px-2 py-2">
      <Dialog open={isCreateOrgOpen} onOpenChange={setIsCreateOrgOpen}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between h-12 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-xl transition-all group"
              disabled={isLoading || isSwitching}
            >
              {isLoading || isSwitching ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  <span className="truncate text-zinc-400">{isSwitching ? 'Trocando...' : 'Carregando...'}</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 overflow-hidden">
                  <Avatar className="w-8 h-8 border border-white/10 shadow-sm">
                    <AvatarImage src={`https://i.pravatar.cc/40?u=${currentOrg?.id || 'org'}`} data-ai-hint="logo organization" />
                    <AvatarFallback className="bg-zinc-800 text-zinc-300 font-semibold">{currentOrg?.name?.slice(0, 2).toUpperCase() || 'OG'}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col items-start truncate">
                    <span className="truncate text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{currentOrg?.name || 'Selecione a Organização'}</span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Plano Gratuito</span>
                  </div>
                </div>
              )}
              <ChevronsUpDown className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px] bg-zinc-950 border-white/10 text-zinc-300 backdrop-blur-xl">
            <DropdownMenuLabel className="text-xs text-zinc-500 uppercase tracking-wider">Suas Organizações</DropdownMenuLabel>
            {organizations.map(org => (
              <DropdownMenuItem
                key={org.id}
                onSelect={() => handleSwitchOrganization(org.id)}
                disabled={org.id === user?.current_organization_id}
                className="focus:bg-white/5 focus:text-white cursor-pointer py-2"
              >
                <Avatar className="w-5 h-5 mr-2 border border-white/10">
                  <AvatarImage src={`https://i.pravatar.cc/40?u=${org.id}`} data-ai-hint="logo organization" />
                  <AvatarFallback className="bg-zinc-800 text-[9px]">{org.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className={cn(org.id === user?.current_organization_id && "font-medium text-violet-400")}>{org.name}</span>
                {org.id === user?.current_organization_id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-white/10" />
            <DialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="focus:bg-white/5 focus:text-white cursor-pointer text-violet-400 focus:text-violet-300">
                <PlusCircle className="mr-2 h-4 w-4" />
                Criar nova organização
              </DropdownMenuItem>
            </DialogTrigger>
          </DropdownMenuContent>
        </DropdownMenu>
        <DialogContent className="bg-zinc-950 border-white/10 text-zinc-200">
          <form onSubmit={handleCreateOrgSubmit}>
            <DialogHeader>
              <DialogTitle>Criar Nova Organização</DialogTitle>
              <DialogDescription className="text-zinc-400">
                Dê um nome para a sua nova organização.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="org-name" className="text-zinc-300">Nome da Organização</Label>
              <Input id="org-name" name="name" required autoFocus className="bg-black/40 border-white/10 focus:border-violet-500/50 text-white mt-1.5" />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={isSubmitting} className="hover:bg-white/5 text-zinc-400 hover:text-white">Cancelar</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting} className="bg-violet-600 hover:bg-violet-700 text-white">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Criar'}
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

  const noShellPages = ['/login', '/logout', '/profile', '/admin', '/presentation'];
  const isNoShellPage = noShellPages.some(p => pathname === p) || pathname.startsWith('/flow/');


  if (loading || (!user && !isNoShellPage)) {
    return <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
      <Loader2 className="h-12 w-12 animate-spin text-violet-600" />
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
      <SidebarPrimitive className="border-r border-white/5 bg-zinc-950">
        <SidebarHeader className="pb-2">
          <div className="flex items-center justify-between px-2 py-3">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-900/20">
                <Zap className="w-5 h-5 text-white fill-white/20" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent tracking-tight">NexusFlow</h1>
            </div>
            <SidebarTrigger className="text-zinc-500 hover:text-white hover:bg-white/5" />
          </div>
          <OrganizationSwitcher />
        </SidebarHeader>
        <SidebarContent className="px-2">
          <SidebarGroup>
            <MainNav />
          </SidebarGroup>
          <OrgNav />
        </SidebarContent>
        <SidebarFooter className="p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 h-14 px-3 hover:bg-white/5 rounded-xl group transition-all">
                <Avatar className="w-9 h-9 border border-white/10 shadow-sm">
                  <AvatarImage src="https://i.pravatar.cc/40?u=user" data-ai-hint="user avatar" />
                  <AvatarFallback className="bg-zinc-800 text-zinc-300">{user?.username?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start truncate">
                  <span className="truncate text-sm font-medium text-zinc-200 group-hover:text-white transition-colors">{user?.username || 'Usuário'}</span>
                  <span className="truncate text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">{user?.email || 'user@nexusflow.com'}</span>
                </div>
                <ChevronsUpDown className="ml-auto w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[240px] mb-2 bg-zinc-950 border-white/10 text-zinc-300 backdrop-blur-xl">
              <DropdownMenuLabel className="text-xs text-zinc-500 uppercase tracking-wider">Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-white/10" />
              <Link href="/profile" passHref>
                <DropdownMenuItem className="focus:bg-white/5 focus:text-white cursor-pointer py-2">
                  <Users className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem disabled className="opacity-50 py-2">
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem onClick={logout} className="text-red-400 focus:bg-red-500/10 focus:text-red-300 cursor-pointer py-2">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </SidebarPrimitive>
      <SidebarInset className="bg-black">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
