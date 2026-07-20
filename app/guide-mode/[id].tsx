import { useLocalSearchParams } from 'expo-router';

import { GuideModeScreen } from '@/features/guides/guide-mode-screen';

export default function GuideModeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <GuideModeScreen guideId={Number(id)} />;
}
