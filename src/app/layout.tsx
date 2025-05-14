
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
    description: 'A drag-and-drop conversational flow builder.',
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
        <body className={cn(
            "min-h-screen bg-background font-sans antialiased",
            fontSans.variable
        )}>
        {children}
        <Toaster />
        </body>
        </html>
    );
}
