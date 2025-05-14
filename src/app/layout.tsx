
import type {Metadata} from 'next';
import { Inter as FontSans } from "next/font/google" // Changed to Inter for a common clean sans-serif
import './globals.css';
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";


const fontSans = FontSans({
    subsets: ["latin"],
    variable: "--font-sans",
})

export const metadata: Metadata = {
    title: 'Flowise Lite',
    description: 'Um construtor de fluxos de conversação com interface de arrastar e soltar.',
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="pt-BR" suppressHydrationWarning>
        <body 
            className={cn(
                "min-h-screen bg-background font-sans antialiased",
                fontSans.variable
            )}
            suppressHydrationWarning={true} // Adicionado aqui
        >
        {children}
        <Toaster />
        </body>
        </html>
    );
}
