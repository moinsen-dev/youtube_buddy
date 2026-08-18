import { CameraView, useCameraPermissions } from 'expo-camera';
import { StyleSheet } from 'react-native';

/**
 * Camera surface for the TV-pairing QR scanner, isolated so that the route
 * file (app/tv-scanner.tsx) never imports expo-camera directly. expo-router
 * eagerly evaluates every file under app/, and expo-camera ships no tvOS
 * native module — a top-level import there takes the whole TV app down with
 * "Cannot find native module 'ExpoCamera'".
 *
 * Route files cannot be swapped per platform: expo-router enumerates them by
 * filename via require.context, so Metro's `.tvos.*` sourceExts never apply.
 * A plain module like this one IS swapped — see qr-camera.tvos.tsx.
 */
export { useCameraPermissions };

export function QrCamera({ onScanned }: { onScanned: (event: { data: string }) => void }) {
  return (
    <CameraView
      style={styles.camera}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={onScanned}
    />
  );
}

const styles = StyleSheet.create({
  camera: { flex: 1 },
});
