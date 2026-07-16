import type { Metadata } from 'next';
import PublicLanding from '@/components/marketing/PublicLanding';

export const metadata: Metadata = {
  title: 'NexusFlow | Automação conversacional que vende melhor',
  description:
    'Organize atendimento, automação e agentes de IA em uma operação mais clara, com planos bem definidos e builder visual.',
};

export default function PresentationPage() {
  return <PublicLanding />;
}
