import { t } from '@/core/i18n/strings';
import { DummyScreen } from '@/features/shell/dummy-screen';

export default function LibraryScreen() {
  return <DummyScreen title={t().tabs.library} />;
}
