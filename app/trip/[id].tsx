import { useLocalSearchParams } from 'expo-router';

import { TripScreen } from '@/features/travel/trip-screen';

export default function TripRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TripScreen tripId={Number(id)} />;
}
