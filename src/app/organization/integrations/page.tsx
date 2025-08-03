
'use client';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, BotMessageSquare, MessageCircle, Settings } from "lucide-react";
import React from 'react';
import { cn } from "@/lib/utils";

const integrations = [
    {
        icon: <BotMessageSquare className="w-8 h-8 text-blue-500" />,
        title: "API Evolution",
        description: "Conecte-se com a API do WhatsApp para enviar e receber mensagens.",
        badge: "Instalado",
        verified: true,
    },
    {
        icon: <MessageCircle className="w-8 h-8 text-sky-500" />,
        title: "Chatwoot",
        description: "Integre com sua plataforma de atendimento ao cliente Chatwoot.",
        badge: "Instalado",
        verified: true,
    },
    {
        icon: <Settings className="w-8 h-8 text-gray-500" />,
        title: "Slack",
        description: "Integre com o Slack para receber notificações e alertas.",
        badge: "BETA",
        verified: false,
    },
        {
        icon: <Settings className="w-8 h-8 text-gray-500" />,
        title: "Jira",
        description: "Crie e gerencie chamados no Jira a partir de conversas.",
        badge: "BETA",
        verified: false,
    },
    {
        icon: <Settings className="w-8 h-8 text-gray-500" />,
        title: "Hubspot",
        description: "Crie Leads no Hubspot a partir de conversas nos seus canais.",
        badge: "BETA",
        verified: false,
    },
    {
        icon: <Settings className="w-8 h-8 text-gray-500" />,
        title: "Instagram",
        description: "Responda a mensagens diretas do Instagram pelo nosso painel.",
        badge: "Grátis",
        verified: true,
    },
     {
        icon: <Settings className="w-8 h-8 text-gray-500" />,
        title: "Messenger",
        description: "Responda a mensagens do Facebook Messenger pelo nosso painel.",
        badge: "Grátis",
        verified: true,
    },
    {
        icon: <Settings className="w-8 h-8 text-gray-500" />,
        title: "Chatbot",
        description: "Transforme seu atendimento com nosso poderoso plugin de Chatbot.",
        badge: "Grátis",
        verified: true,
    }
];

const IntegrationCard = ({ icon, title, description, badge, verified }: (typeof integrations)[0]) => {
    const getBadgeClass = () => {
        switch (badge) {
            case "Instalado":
                return "bg-green-100 text-green-800 border-green-300";
            case "BETA":
                return "bg-yellow-100 text-yellow-800 border-yellow-300";
            case "Grátis":
                return "bg-blue-100 text-blue-800 border-blue-300";
            default:
                return "bg-secondary text-secondary-foreground";
        }
    };

    return (
        <Card className="hover:shadow-lg transition-shadow duration-300 flex flex-col">
            <CardContent className="p-6 flex-grow">
                <div className="flex justify-between items-start">
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                        {icon}
                    </div>
                    <Badge className={cn("text-xs", getBadgeClass())}>{badge}</Badge>
                </div>
                <div className="mt-4">
                    <h3 className="text-lg font-semibold flex items-center gap-1.5">
                        {verified && <CheckCircle className="w-5 h-5 text-green-600" />}
                        {title}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">
                        {description}
                    </p>
                </div>
            </CardContent>
            <div className="p-6 pt-0 mt-auto">
                 <Button className="w-full">
                    {badge === "Instalado" ? "Gerenciar" : "Instalar"}
                </Button>
            </div>
        </Card>
    );
};

export default function IntegrationsPage() {
    return (
        <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Extensões e Integrações</h2>
            </div>
            <p className="text-muted-foreground">
                Conecte suas ferramentas favoritas para automatizar ainda mais seus fluxos de trabalho.
            </p>

            <div className="grid gap-6 mt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {integrations.map((integration, index) => (
                    <IntegrationCard key={index} {...integration} />
                ))}
            </div>
        </div>
    );
}
