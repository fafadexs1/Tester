
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle, GitBranch, Shield, Zap, BotMessageSquare, MessageCircle, BrainCircuit, History, FileText, Share2, TrendingUp, Clock, Users, Workflow } from 'lucide-react';
import Link from 'next/link';

const features = [
    {
        icon: <GitBranch className="w-6 h-6 text-primary" />,
        title: "Editor Visual Intuitivo",
        description: "Crie fluxos de conversa complexos com uma interface de arrastar e soltar. Sem necessidade de código."
    },
    {
        icon: <BrainCircuit className="w-6 h-6 text-primary" />,
        title: "Inteligência Artificial Integrada",
        description: "Utilize o poder do Genkit para gerar respostas inteligentes, criar agentes conversacionais e analisar texto."
    },
    {
        icon: <BotMessageSquare className="w-6 h-6 text-primary" />,
        title: "Integração com WhatsApp",
        description: "Envie e receba mensagens, imagens e documentos diretamente pelo WhatsApp através da API Evolution."
    },
    {
        icon: <MessageCircle className="w-6 h-6 text-primary" />,
        title: "Conexão com Chatwoot",
        description: "Inicie fluxos a partir de conversas no Chatwoot e responda diretamente na plataforma de atendimento."
    },
    {
        icon: <History className="w-6 h-6 text-primary" />,
        title: "Histórico de Versões",
        description: "Salve e restaure versões anteriores do seu fluxo com um clique, garantindo segurança e rastreabilidade."
    },
    {
        icon: <Shield className="w-6 h-6 text-primary" />,
        title: "Logs de Auditoria",
        description: "Monitore todas as ações importantes realizadas na plataforma, com filtros por usuário, data e fluxo."
    }
];

const marketValues = [
    {
        icon: <Clock className="w-8 h-8 text-accent" />,
        title: "Redução de Tempo e Custo",
        description: "Capacite equipes não técnicas a criar e gerenciar automações, liberando desenvolvedores para tarefas mais complexas."
    },
    {
        icon: <TrendingUp className="w-8 h-8 text-accent" />,
        title: "Agilidade e Escalabilidade",
        description: "Lance novos fluxos de comunicação em minutos, não semanas. Adapte-se rapidamente às necessidades do mercado e escale suas operações."
    },
    {
        icon: <Users className="w-8 h-8 text-accent" />,
        title: "Melhora na Experiência do Cliente",
        description: "Ofereça um atendimento consistente, rápido e inteligente, 24/7, aumentando a satisfação e a retenção de clientes."
    }
];

export default function PresentationPage() {
    return (
        <div className="bg-background text-foreground">
            <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container flex h-16 items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold">
                        <Workflow className="h-6 w-6 text-primary" />
                        <span>NexusFlow</span>
                    </Link>
                    <Button asChild>
                        <Link href="/">Voltar ao App</Link>
                    </Button>
                </div>
            </header>

            <main>
                {/* Hero Section */}
                <section className="container text-center py-20 sm:py-28">
                    <Zap className="w-16 h-16 text-primary mx-auto mb-6" />
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter mb-4">
                        Automatize. Integre. Inove.
                    </h1>
                    <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-8">
                        NexusFlow é a plataforma visual que transforma a maneira como sua empresa se comunica, permitindo a criação de fluxos de automação poderosos sem escrever uma única linha de código.
                    </p>
                    <Button size="lg">Agende uma Demonstração</Button>
                </section>

                {/* The Problem & Solution */}
                <section className="bg-muted py-20">
                    <div className="container grid md:grid-cols-2 gap-12 items-center">
                        <div>
                            <h2 className="text-3xl font-bold mb-4">O Desafio da Comunicação Moderna</h2>
                            <p className="text-muted-foreground leading-relaxed">
                                Empresas lutam com sistemas de comunicação fragmentados, altos custos de desenvolvimento para automações e a dificuldade de oferecer um atendimento ao cliente que seja ao mesmo tempo rápido, personalizado e escalável. A dependência de equipes técnicas para cada pequena alteração cria gargalos e atrasa a inovação.
                            </p>
                        </div>
                        <Card className="shadow-lg">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-3">
                                    <CheckCircle className="w-8 h-8 text-green-500" />
                                    A Solução NexusFlow
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="leading-relaxed">
                                    Oferecemos uma plataforma unificada onde sua equipe pode visualizar, criar e modificar fluxos de comunicação em tempo real. Com integrações nativas e um poderoso motor de IA, o NexusFlow remove a complexidade e coloca o poder da automação nas mãos de quem entende do negócio.
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                {/* Features Section */}
                <section className="container py-20">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold">Funcionalidades Chave</h2>
                        <p className="text-muted-foreground mt-2">Tudo o que você precisa para criar experiências de comunicação excepcionais.</p>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => (
                            <Card key={index} className="bg-card/50 hover:bg-muted/80 transition-colors duration-300">
                                <CardHeader>
                                    <div className="flex items-center gap-4">
                                        {feature.icon}
                                        <CardTitle className="text-xl">{feature.title}</CardTitle>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-muted-foreground">{feature.description}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </section>

                {/* Market Value Section */}
                <section className="bg-muted py-20">
                    <div className="container">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold">Valor para o seu Negócio</h2>
                            <p className="text-muted-foreground mt-2">Mais do que uma ferramenta, um investimento estratégico.</p>
                        </div>
                        <div className="grid md:grid-cols-3 gap-8 text-center">
                            {marketValues.map((value, index) => (
                                <div key={index} className="p-6">
                                    {value.icon}
                                    <h3 className="text-xl font-semibold mt-5 mb-2">{value.title}</h3>
                                    <p className="text-muted-foreground">{value.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                
                 {/* Call to Action Section */}
                <section className="container text-center py-20">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Pronto para transformar sua comunicação?
                    </h2>
                    <p className="max-w-2xl mx-auto text-muted-foreground mb-8">
                        Veja o NexusFlow em ação e descubra como podemos ajudar sua empresa a atingir o próximo nível de automação e eficiência.
                    </p>
                    <Button size="lg" className="bg-accent hover:bg-accent/90 text-accent-foreground">
                        Fale com um Especialista
                    </Button>
                </section>
            </main>

            <footer className="border-t">
                <div className="container py-6 text-center text-muted-foreground text-sm">
                    © {new Date().getFullYear()} NexusFlow. Todos os direitos reservados.
                </div>
            </footer>
        </div>
    );
}
