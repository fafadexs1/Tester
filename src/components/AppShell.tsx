
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
  SidebarMenuSubItem
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/components/auth/AuthProvider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { Organization } from '@/lib/types';
import { getOrganizationsForUserAction } from '@/app/actions/organizationActions';
import { ChevronsUpDown, Workflow, BarChart2, Building, Users, CreditCard, ScrollText, Settings, LogOut, Zap, LifeBuoy, Loader2, PlusCircle, Mail, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const MainNav = () => {
  const pathname = usePathname();
  const isActive = (path: string) => pathname.startsWith(path);
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Link href="/" passHref>
          <SidebarMenuButton isActive={pathname === '/'} tooltip="Fluxos de Trabalho">
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
    const isActive = (path: string) => pathname.startsWith(path);
    const { user } = useAuth();
    const [isAccessMenuOpen, setIsAccessMenuOpen] = useState(false);

    useEffect(() => {
        // Abre o menu se uma das suas subpáginas estiver ativa
        if (isActive('/organization/members')) {
            setIsAccessMenuOpen(true);
        }
    }, [isActive]);

    return (
        <SidebarGroup>
            <SidebarGroupLabel>Configurações da Organização</SidebarGroupLabel>
            <SidebarMenu>
                <SidebarMenuItem>
                    <Link href="/organization/general" passHref>
                        <SidebarMenuButton isActive={isActive('/organization/general')} tooltip="Geral">
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
                                <Link href="/organization/members" passHref>
                                    <SidebarMenuSubButton isActive={isActive('/organization/members')}>
                                        Membros e Times
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuSubItem>
                            <SidebarMenuSubItem>
                                <Link href="/organization/members?tab=roles" passHref>
                                    <SidebarMenuSubButton isActive={pathname.includes('?tab=roles')}>
                                        Cargos e Permissões
                                    </SidebarMenuSubButton>
                                </Link>
                            </SidebarMenuSubItem>
                        </SidebarMenuSub>
                    )}
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/organization/billing" passHref>
                        <SidebarMenuButton isActive={isActive('/organization/billing')} tooltip="Billing e Assinatura">
                           <CreditCard />
                           <span>Billing e Assinatura</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <Link href="/organization/audit" passHref>
                        <SidebarMenuButton isActive={isActive('/organization/audit')} tooltip="Logs de Auditoria">
                           <ScrollText />
                           <span>Logs de Auditoria</span>
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
                {user?.role === 'desenvolvedor' && (
                    <SidebarMenuItem>
                        <Link href="/organization/email" passHref>
                            <SidebarMenuButton isActive={isActive('/organization/email')} tooltip="E-mail (SMTP)">
                               <Mail />
                               <span>E-mail (SMTP)</span>
                            </SidebarMenuButton>
                        </Link>
                    </SidebarMenuItem>
                )}
                 <SidebarMenuItem>
                    <Link href="/organization/integrations" passHref>
                        <SidebarMenuButton isActive={isActive('/organization/integrations')} tooltip="Integrações">
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

  useEffect(() => {
    const fetchOrgs = async () => {
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
    };

    fetchOrgs();
  }, [user, toast]);

  const currentOrg = organizations.find(org => org.id === user?.current_organization_id);

  return (
    <div className="p-2">
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
           <DropdownMenuItem>
             <PlusCircle className="mr-2 h-4 w-4" />
             Criar nova organização
           </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  
  const noShellPages = ['/login', '/logout'];
  const isNoShellPage = noShellPages.some(p => pathname.startsWith(p)) || pathname.startsWith('/flow/');

  if (loading || isNoShellPage || !user) {
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
