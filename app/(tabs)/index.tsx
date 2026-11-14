import { Screen } from '@/components/layout/Screen';
import { CommandDashboard } from '@/components/feature/CommandDashboard';
export default function HomePage() {
  return <Screen title="HOME DASHBOARD" icon="home-outline" dashboard><CommandDashboard /></Screen>;
}
