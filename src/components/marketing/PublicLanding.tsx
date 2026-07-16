import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Fraunces, Manrope } from 'next/font/google';
import {
  ArrowRight,
  BotMessageSquare,
  BrainCircuit,
  Check,
  CheckCircle,
  ChevronRight,
  Clock,
  FileText,
  GitBranch,
  MessageCircle,
  Shield,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-marketing-sans',
});

const serif = Fraunces({
  subsets: ['latin'],
  variable: '--font-marketing-serif',
  weight: ['600', '700'],
});

const landingTheme = {
  '--marketing-bg': '#f5f1e8',
  '--marketing-surface': '#fffdf9',
  '--marketing-surface-strong': '#ffffff',
  '--marketing-border': '#ded7ca',
  '--marketing-ink': '#15212b',
  '--marketing-muted': '#5d6975',
  '--marketing-accent': '#0f766e',
  '--marketing-accent-soft': '#d9f3ef',
  '--marketing-warm': '#d97706',
} as CSSProperties;

const outcomes = [
  {
    icon: Workflow,
    title: 'Fluxos que o time entende de primeira',
    description:
      'Monte jornadas comerciais, suporte e onboarding em um editor visual sem depender de sprint para cada ajuste.',
  },
  {
    icon: BrainCircuit,
    title: 'Agentes com contexto e ferramentas reais',
    description:
      'Conecte memória, base de conhecimento, APIs e ações para o agente continuar a conversa sem parecer improvisado.',
  },
  {
    icon: MessageCircle,
    title: 'Operação unificada em canais de atendimento',
    description:
      'WhatsApp, Chatwoot, knowledge e automações ficam na mesma operação, com menos remendo e mais controle.',
  },
];

const pillars = [
  {
    icon: BotMessageSquare,
    eyebrow: 'Orquestração',
    title: 'Da intenção até a ação, no mesmo fluxo',
    text: 'O NexusFlow não para na resposta. Ele consulta conhecimento, usa tools, coleta dados e encaminha a próxima etapa com rastreabilidade.',
  },
  {
    icon: GitBranch,
    eyebrow: 'Governança',
    title: 'Seu processo deixa de morar no improviso',
    text: 'Versionamento, regras de rota, nós reutilizáveis e histórico tornam a operação mais previsível para comercial, suporte e produto.',
  },
  {
    icon: Shield,
    eyebrow: 'Escala',
    title: 'Mais volume sem sacrificar qualidade',
    text: 'Padronize respostas, reduza desvio operacional e mantenha a experiência consistente mesmo com equipes e fluxos diferentes.',
  },
];

const plans = [
  {
    name: 'Plano Gratuito',
    price: 'R$ 0',
    cadence: '/mês',
    audience: 'Para validar a operação e sair do papel sem custo inicial.',
    emphasis: 'Comece pequeno, com estrutura suficiente para publicar e aprender.',
    ctaLabel: 'Começar agora',
    ctaHref: '/login',
    featured: false,
    features: [
      '1 organização ativa',
      '1 workspace principal',
      'Até 2 membros da equipe',
      'Construtor visual com automações básicas',
      'Conexão inicial de canal e testes',
    ],
  },
  {
    name: 'Plano Pro',
    price: 'US$ 49',
    cadence: '/mês',
    audience: 'Para times que já dependem de atendimento, vendas e automação no dia a dia.',
    emphasis: 'É o plano certo para operar com mais volume sem perder clareza.',
    ctaLabel: 'Entrar no plano Pro',
    ctaHref: '/login',
    featured: true,
    features: [
      '10 membros de equipe',
      'Workspaces ilimitados',
      'Logs de auditoria por 90 dias',
      'Agentes com memória, tools e knowledge',
      'Suporte prioritário por e-mail',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Sob consulta',
    cadence: '',
    audience: 'Para operações críticas, múltiplas áreas ou rollout com acompanhamento próximo.',
    emphasis: 'Indicado quando a implantação precisa de governança e desenho sob medida.',
    ctaLabel: 'Falar sobre Enterprise',
    ctaHref: '/login',
    featured: false,
    features: [
      'Arquitetura e limites ajustados ao volume',
      'Onboarding assistido na implantação',
      'Governança operacional personalizada',
      'Acompanhamento próximo na evolução',
      'Prioridade máxima em suporte e estratégia',
    ],
  },
];

const comparisonRows = [
  {
    label: 'Membros de equipe',
    values: ['Até 2', 'Até 10', 'Definido no projeto'],
  },
  {
    label: 'Workspaces',
    values: ['1 principal', 'Ilimitados', 'Ilimitados'],
  },
  {
    label: 'Agentes com memória e tools',
    values: ['Básico', 'Completo', 'Completo com desenho dedicado'],
  },
  {
    label: 'Logs e auditoria',
    values: ['Essencial', '90 dias', 'Política personalizada'],
  },
  {
    label: 'Onboarding',
    values: ['Autônomo', 'Guiado', 'Assistido'],
  },
  {
    label: 'Suporte',
    values: ['Base e documentação', 'Prioritário por e-mail', 'Prioridade máxima'],
  },
];

const faqs = [
  {
    question: 'O NexusFlow é para time técnico ou para operação?',
    answer:
      'Para os dois. O time de negócio ganha autonomia no builder visual, e o time técnico entra onde realmente agrega: integrações, governança e arquitetura.',
  },
  {
    question: 'O plano Gratuito serve para uso real ou só para teste?',
    answer:
      'Ele serve para validar processo, publicar o fluxo inicial e entender a operação. Quando o volume e a equipe crescem, o Pro passa a fazer mais sentido.',
  },
  {
    question: 'O que muda de verdade no Pro?',
    answer:
      'O Pro é onde a plataforma deixa de ser experimento e vira operação: mais membros, workspaces ilimitados, auditoria e uso mais maduro de agentes, memória e tools.',
  },
  {
    question: 'Enterprise é só para empresa grande?',
    answer:
      'Não. Enterprise faz sentido quando a implantação exige acompanhamento próximo, regras específicas de operação ou desenho mais cuidadoso de governança.',
  },
];

const productSignals = [
  'Builder visual para fluxos reais',
  'Agentes com tools, memória e knowledge',
  'Integrações para operação comercial e atendimento',
];

const planHighlights = [
  {
    label: 'Mais simples para começar',
    plan: 'Plano Gratuito',
  },
  {
    label: 'Melhor custo-benefício',
    plan: 'Plano Pro',
  },
  {
    label: 'Implantação acompanhada',
    plan: 'Enterprise',
  },
];

export default function PublicLanding() {
  return (
    <div
      style={landingTheme}
      className={`${sans.variable} ${serif.variable} min-h-screen bg-[var(--marketing-bg)] font-[family:var(--font-marketing-sans)] text-[var(--marketing-ink)]`}
    >
      <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.16),_transparent_54%),radial-gradient(circle_at_right,_rgba(217,119,6,0.14),_transparent_36%)]" />

      <header className="sticky top-0 z-40 border-b border-[var(--marketing-border)]/70 bg-[rgba(245,241,232,0.82)] backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between gap-6">
          <Link href="/presentation" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--marketing-ink)] text-white shadow-[0_16px_40px_rgba(21,33,43,0.18)]">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--marketing-muted)]">
                NexusFlow
              </p>
              <p className="text-sm font-semibold text-[var(--marketing-ink)]">
                Automação conversacional para operação real
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-[var(--marketing-muted)] md:flex">
            <Link href="#produto" className="transition-colors hover:text-[var(--marketing-ink)]">
              Produto
            </Link>
            <Link href="#planos" className="transition-colors hover:text-[var(--marketing-ink)]">
              Planos
            </Link>
            <Link href="#faq" className="transition-colors hover:text-[var(--marketing-ink)]">
              FAQ
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              asChild
              variant="ghost"
              className="hidden rounded-full px-5 text-[var(--marketing-ink)] hover:bg-white/70 hover:text-[var(--marketing-ink)] sm:inline-flex"
            >
              <Link href="/login">Entrar</Link>
            </Button>
            <Button
              asChild
              className="rounded-full bg-[var(--marketing-ink)] px-5 text-white shadow-[0_16px_40px_rgba(21,33,43,0.18)] hover:bg-[#0d1720]"
            >
              <Link href="#planos">Ver planos</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="overflow-hidden">
        <section className="container grid gap-14 pb-20 pt-14 md:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] md:pb-28 md:pt-20">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--marketing-border)] bg-white/80 px-4 py-2 text-sm font-medium text-[var(--marketing-muted)] shadow-[0_8px_24px_rgba(21,33,43,0.06)]">
              <Sparkles className="h-4 w-4 text-[var(--marketing-accent)]" />
              Atendimento, vendas e automação sem cara de gambiarra
            </div>

            <h1 className="max-w-4xl font-[family:var(--font-marketing-serif)] text-5xl font-semibold leading-[0.96] tracking-[-0.04em] text-[var(--marketing-ink)] md:text-7xl">
              Seu fluxo pode vender melhor do que a sua página atual.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--marketing-muted)] md:text-xl">
              O NexusFlow organiza atendimento, automação e agentes de IA em um só lugar.
              Você tira a operação do improviso, publica fluxos mais rápido e deixa claro o
              que cada plano entrega.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Button
                asChild
                size="lg"
                className="rounded-full bg-[var(--marketing-ink)] px-7 text-white hover:bg-[#0d1720]"
              >
                <Link href="/login">
                  Começar com o plano gratuito
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="rounded-full border-[var(--marketing-border)] bg-white/70 px-7 text-[var(--marketing-ink)] hover:bg-white"
              >
                <Link href="#produto">
                  Ver como funciona
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {productSignals.map((signal) => (
                <div
                  key={signal}
                  className="rounded-2xl border border-[var(--marketing-border)] bg-white/70 px-4 py-4 text-sm font-medium text-[var(--marketing-ink)] shadow-[0_10px_30px_rgba(21,33,43,0.05)]"
                >
                  {signal}
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="animate-float absolute -left-8 top-12 hidden h-28 w-28 rounded-full bg-[rgba(15,118,110,0.12)] blur-3xl lg:block" />
            <div className="absolute -right-8 bottom-6 hidden h-32 w-32 rounded-full bg-[rgba(217,119,6,0.12)] blur-3xl lg:block" />

            <div className="relative rounded-[32px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-5 shadow-[0_28px_80px_rgba(21,33,43,0.12)]">
              <div className="rounded-[26px] border border-[var(--marketing-border)] bg-[linear-gradient(180deg,#ffffff_0%,#f7f4ed_100%)] p-5">
                <div className="flex items-center justify-between rounded-2xl border border-[var(--marketing-border)] bg-white px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--marketing-muted)]">
                      Operação publicada
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[var(--marketing-ink)]">
                      Comercial + suporte + knowledge
                    </p>
                  </div>
                  <div className="rounded-full bg-[var(--marketing-accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--marketing-accent)]">
                    Fluxo ativo
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
                  <div className="rounded-[24px] border border-[var(--marketing-border)] bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--marketing-accent-soft)] text-[var(--marketing-accent)]">
                        <Workflow className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[var(--marketing-ink)]">
                          Fluxo comercial em execução
                        </p>
                        <p className="text-sm text-[var(--marketing-muted)]">
                          Captação, qualificação e handoff mais organizados.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      {[
                        'Identifica a intenção e responde com contexto.',
                        'Consulta knowledge antes de falar de plano e preço.',
                        'Coleta apenas o que falta e registra o atendimento.',
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3 rounded-2xl bg-[#f7f4ed] px-3 py-3">
                          <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--marketing-accent)]" />
                          <p className="text-sm leading-6 text-[var(--marketing-muted)]">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[24px] border border-[var(--marketing-border)] bg-white p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3df] text-[var(--marketing-warm)]">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-[var(--marketing-ink)]">
                            Menos espera para ajustar
                          </p>
                          <p className="text-sm text-[var(--marketing-muted)]">
                            O time de negócio altera o fluxo sem abrir chamada para tudo.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-[var(--marketing-border)] bg-[#16222c] p-5 text-white">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                        O que muda no dia a dia
                      </p>
                      <div className="mt-4 space-y-4">
                        {[
                          {
                            icon: Users,
                            title: 'Equipe mais alinhada',
                            text: 'Comercial, suporte e produto enxergam o mesmo fluxo.',
                          },
                          {
                            icon: TrendingUp,
                            title: 'Mais clareza para crescer',
                            text: 'Planos, operação e limites ficam explícitos para o cliente.',
                          },
                          {
                            icon: FileText,
                            title: 'Menos resposta improvisada',
                            text: 'Contexto, guardrails e tools ajudam o agente a não sair do trilho.',
                          },
                        ].map((item) => (
                          <div key={item.title} className="flex items-start gap-3">
                            <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[#7dd3c7]" />
                            <div>
                              <p className="text-sm font-semibold">{item.title}</p>
                              <p className="text-sm leading-6 text-white/65">{item.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="produto" className="container pb-20 md:pb-28">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--marketing-accent)]">
              Produto
            </p>
            <h2 className="mt-4 font-[family:var(--font-marketing-serif)] text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
              O valor não está em parecer moderno. Está em operar melhor.
            </h2>
            <p className="mt-5 text-lg leading-8 text-[var(--marketing-muted)]">
              A página precisa vender uma promessa simples: seu atendimento e sua automação
              ficam mais claros, mais rápidos e mais controláveis. O resto é ruído.
            </p>
          </div>

          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {outcomes.map((outcome) => (
              <article
                key={outcome.title}
                className="rounded-[28px] border border-[var(--marketing-border)] bg-white/80 p-7 shadow-[0_18px_44px_rgba(21,33,43,0.06)]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--marketing-accent-soft)] text-[var(--marketing-accent)]">
                  <outcome.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-[var(--marketing-ink)]">
                  {outcome.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-[var(--marketing-muted)]">
                  {outcome.description}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {pillars.map((pillar) => (
              <article
                key={pillar.title}
                className="rounded-[28px] border border-[var(--marketing-border)] bg-[var(--marketing-surface)] p-7"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0ede5] text-[var(--marketing-ink)]">
                    <pillar.icon className="h-5 w-5" />
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--marketing-muted)]">
                    {pillar.eyebrow}
                  </p>
                </div>
                <h3 className="mt-6 text-xl font-semibold text-[var(--marketing-ink)]">
                  {pillar.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-[var(--marketing-muted)]">
                  {pillar.text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="planos" className="border-y border-[var(--marketing-border)] bg-white/70 py-20 md:py-28">
          <div className="container">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--marketing-accent)]">
                  Planos
                </p>
                <h2 className="mt-4 font-[family:var(--font-marketing-serif)] text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                  Cada plano responde a um estágio claro da operação.
                </h2>
                <p className="mt-5 text-lg leading-8 text-[var(--marketing-muted)]">
                  Sem lista confusa e sem promessa vaga. O cliente bate o olho e entende
                  quando usar o Gratuito, quando faz sentido migrar para o Pro e quando vale
                  abrir uma conversa Enterprise.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {planHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-4 py-4"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--marketing-muted)]">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[var(--marketing-ink)]">
                      {item.plan}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 grid gap-6 xl:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.name}
                  className={[
                    'rounded-[32px] border p-8 shadow-[0_18px_44px_rgba(21,33,43,0.06)]',
                    plan.featured
                      ? 'border-[var(--marketing-ink)] bg-[var(--marketing-ink)] text-white'
                      : 'border-[var(--marketing-border)] bg-[var(--marketing-surface-strong)] text-[var(--marketing-ink)]',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p
                        className={[
                          'text-xs font-semibold uppercase tracking-[0.22em]',
                          plan.featured ? 'text-white/55' : 'text-[var(--marketing-muted)]',
                        ].join(' ')}
                      >
                        {plan.name}
                      </p>
                      <p className="mt-5 text-4xl font-semibold tracking-[-0.04em]">
                        {plan.price}
                        {plan.cadence && (
                          <span
                            className={[
                              'ml-1 text-base font-medium',
                              plan.featured ? 'text-white/65' : 'text-[var(--marketing-muted)]',
                            ].join(' ')}
                          >
                            {plan.cadence}
                          </span>
                        )}
                      </p>
                    </div>
                    {plan.featured && (
                      <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#8ee7da]">
                        Mais escolhido
                      </div>
                    )}
                  </div>

                  <p
                    className={[
                      'mt-6 text-base leading-7',
                      plan.featured ? 'text-white/78' : 'text-[var(--marketing-muted)]',
                    ].join(' ')}
                  >
                    {plan.audience}
                  </p>

                  <div
                    className={[
                      'mt-6 rounded-3xl p-4 text-sm leading-6',
                      plan.featured ? 'bg-white/7 text-white/78' : 'bg-[#f5f1e8] text-[var(--marketing-muted)]',
                    ].join(' ')}
                  >
                    {plan.emphasis}
                  </div>

                  <ul className="mt-8 space-y-4">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <div
                          className={[
                            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                            plan.featured ? 'bg-[#8ee7da]/18 text-[#8ee7da]' : 'bg-[var(--marketing-accent-soft)] text-[var(--marketing-accent)]',
                          ].join(' ')}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </div>
                        <span className={plan.featured ? 'text-white/86' : 'text-[var(--marketing-ink)]'}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    asChild
                    className={[
                      'mt-8 h-12 w-full rounded-full',
                      plan.featured
                        ? 'bg-white text-[var(--marketing-ink)] hover:bg-white/92'
                        : 'bg-[var(--marketing-ink)] text-white hover:bg-[#0d1720]',
                    ].join(' ')}
                  >
                    <Link href={plan.ctaHref}>{plan.ctaLabel}</Link>
                  </Button>
                </article>
              ))}
            </div>

            <div className="mt-10 overflow-hidden rounded-[32px] border border-[var(--marketing-border)] bg-[var(--marketing-surface-strong)] shadow-[0_18px_44px_rgba(21,33,43,0.04)]">
              <div className="overflow-x-auto">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] border-b border-[var(--marketing-border)] bg-[#f5f1e8] text-sm font-semibold text-[var(--marketing-ink)]">
                    <div className="px-6 py-4">Comparativo rápido</div>
                    {plans.map((plan) => (
                      <div key={plan.name} className="border-l border-[var(--marketing-border)] px-6 py-4 text-center">
                        {plan.name}
                      </div>
                    ))}
                  </div>

                  {comparisonRows.map((row, index) => (
                    <div
                      key={row.label}
                      className={[
                        'grid grid-cols-[1.2fr_repeat(3,minmax(0,1fr))] text-sm',
                        index !== comparisonRows.length - 1 ? 'border-b border-[var(--marketing-border)]' : '',
                      ].join(' ')}
                    >
                      <div className="px-6 py-4 font-medium text-[var(--marketing-ink)]">{row.label}</div>
                      {row.values.map((value) => (
                        <div
                          key={`${row.label}-${value}`}
                          className="border-l border-[var(--marketing-border)] px-6 py-4 text-center text-[var(--marketing-muted)]"
                        >
                          {value}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="container py-20 md:py-28">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[var(--marketing-accent)]">
                FAQ
              </p>
              <h2 className="mt-4 font-[family:var(--font-marketing-serif)] text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                As dúvidas que travam compra precisam estar respondidas aqui.
              </h2>
              <p className="mt-5 text-lg leading-8 text-[var(--marketing-muted)]">
                A landing não deve empurrar o cliente para adivinhar o que cada plano faz.
                Ela deve reduzir fricção e dar segurança para o próximo passo.
              </p>
            </div>

            <div className="space-y-4">
              {faqs.map((item) => (
                <article
                  key={item.question}
                  className="rounded-[28px] border border-[var(--marketing-border)] bg-white/80 p-6 shadow-[0_12px_34px_rgba(21,33,43,0.05)]"
                >
                  <h3 className="text-lg font-semibold text-[var(--marketing-ink)]">{item.question}</h3>
                  <p className="mt-3 text-base leading-7 text-[var(--marketing-muted)]">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container pb-20 md:pb-28">
          <div className="rounded-[36px] border border-[var(--marketing-border)] bg-[linear-gradient(135deg,#14202a_0%,#1d2d39_100%)] px-8 py-10 text-white shadow-[0_28px_80px_rgba(21,33,43,0.18)] md:px-12 md:py-14">
            <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#8ee7da]">
                  Próximo passo
                </p>
                <h2 className="mt-4 font-[family:var(--font-marketing-serif)] text-4xl font-semibold tracking-[-0.03em] md:text-5xl">
                  Se a página precisa vender melhor, ela precisa ser mais clara do que bonita.
                </h2>
                <p className="mt-5 max-w-2xl text-lg leading-8 text-white/72">
                  O produto já tem material forte para isso: builder visual, agentes com tools,
                  memória, knowledge e integrações. A landing só precisa mostrar isso com menos ruído
                  e com planos bem posicionados.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row lg:justify-end">
                <Button asChild size="lg" className="rounded-full bg-white px-7 text-[var(--marketing-ink)] hover:bg-white/92">
                  <Link href="/login">
                    Entrar na plataforma
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/18 bg-transparent px-7 text-white hover:bg-white/10"
                >
                  <Link href="#planos">Revisar planos</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--marketing-border)] bg-white/60">
        <div className="container flex flex-col gap-4 py-8 text-sm text-[var(--marketing-muted)] md:flex-row md:items-center md:justify-between">
          <p>NexusFlow. Builder visual para atendimento, automação e agentes com contexto.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="#produto" className="transition-colors hover:text-[var(--marketing-ink)]">
              Produto
            </Link>
            <Link href="#planos" className="transition-colors hover:text-[var(--marketing-ink)]">
              Planos
            </Link>
            <Link href="/login" className="transition-colors hover:text-[var(--marketing-ink)]">
              Entrar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
