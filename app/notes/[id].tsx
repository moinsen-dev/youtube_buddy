import { useLocalSearchParams } from 'expo-router';

import { NoteDetailScreen } from '@/features/knowledge/note-detail-screen';

export default function NoteRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NoteDetailScreen noteId={Number(id)} />;
}
