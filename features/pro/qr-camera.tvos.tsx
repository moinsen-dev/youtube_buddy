/**
 * tvOS stub for the QR camera (phase 12 / TV-Konsolidierung): expo-camera has
 * no tvOS native module. The TV *shows* the pairing QR code
 * (features/tv/tv-pairing.tsx) and never scans one, so the scanner route is
 * unreachable here — it only has to stay importable. Metro resolves this file
 * instead of qr-camera.tsx when bundling with EXPO_TV=1 (see metro.config.js).
 */

interface PermissionState {
  granted: boolean;
}

export function useCameraPermissions(): [PermissionState, () => Promise<void>] {
  return [{ granted: false }, async () => {}];
}

export function QrCamera(_props: { onScanned: (event: { data: string }) => void }) {
  return null;
}
