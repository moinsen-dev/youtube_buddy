import { useLocalSearchParams } from 'expo-router';

import { VideoScreen } from '@/features/player/video-screen';

export default function VideoRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <VideoScreen videoId={id} />;
}
