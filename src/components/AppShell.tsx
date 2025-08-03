'use client';

import {
  Sidebar as SidebarPrimitive,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
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
import { ChevronsUpDown, Workflow, BarChart2, Building, Users, CreditCard, ScrollText, Settings, LogOut, Zap, LifeBuoy } from 'lucide-react';

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
                    <Link href="/organization/members" passHref>
                        <SidebarMenuButton isActive={isActive('/organization/members')} tooltip="Membros e Times">
                           <Users />
                           <span>Membros e Times</span>
                        </SidebarMenuButton>
                    </Link>
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
  return (
    <div className="p-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6">
                <AvatarImage src="https://i.pravatar.cc/40?u=org1" data-ai-hint="logo organization" />
                <AvatarFallback>MO</AvatarFallback>
              </Avatar>
              <span className="truncate">Minha Organização</span>
            </div>
            <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[var(--sidebar-width)]">
          <DropdownMenuLabel>Organizações</DropdownMenuLabel>
          <DropdownMenuItem>Organização 2</DropdownMenuItem>
          <DropdownMenuItem>Organização 3</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();
  
  const noShellPages = ['/login', '/logout', '/flow'];
  const isNoShellPage = noShellPages.some(p => pathname.startsWith(p));

  // If we are on a no-shell page, or there's no user, just render the children directly.
  if (isNoShellPage || !user) {
    return <>{children}</>;
  }
  
  // Otherwise, render the full shell with the sidebar and the main content area.
  return (
    <div className='flex'>
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
      </SidebarPrimitive>
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}