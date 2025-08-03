import type { Metadata } from 'next';
import { Inter as FontSans } from "next/font/google";
import './globals.css';
import { cn } from "@/lib/utils";
import Providers from '@/components/Providers';
import { SidebarProvider } from '@/components/ui/sidebar';
import AppShell from '@/components/AppShell';

const fontSans = FontSans({
    subsets: ["latin"],
    variable: "--font-sans",
});

export const metadata: Metadata = {
    title: 'NexusFlow',
    description: 'Um construtor de fluxos de conversação com interface de arrastar e soltar.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" suppressHydrationWarning={true}>
            <body
                suppressHydrationWarning={true}
                className={cn(
                    "min-h-screen bg-background font-sans antialiased",
                    fontSans.variable
                )}
            >
                <Providers>
                    <SidebarProvider>
                        <AppShell>
                            {children}
                        </AppShell>
                    </SidebarProvider>
                </Providers>
            </body>
        </html>
    );
}
