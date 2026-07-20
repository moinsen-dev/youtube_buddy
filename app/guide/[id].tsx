import { useLocalSearchParams } from 'expo-router';

import { GuideScreen } from '@/features/guides/guide-screen';

export default function GuideRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GuideScreen guideId={Number(id)} />;
}
