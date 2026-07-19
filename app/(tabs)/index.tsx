import { t } from '@/core/i18n/strings';
import { DummyScreen } from '@/features/shell/dummy-screen';

export default function HomeScreen() {
  return <DummyScreen title={t().tabs.home} />;
}
