import { useLocalSearchParams } from 'expo-router';

import { VideoScreen } from '@/features/player/video-screen';

export default function VideoRoute() {
  const { id, t } = useLocalSearchParams<{ id: string; t?: string }>();
  const startAt = t ? Math.max(0, Number.parseFloat(t) || 0) : 0;
  return <VideoScreen videoId={id} startAtSec={startAt} />;
}
