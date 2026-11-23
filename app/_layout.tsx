import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { TrackerProvider } from '@/contexts/TrackerContext';
import { SignatureDraftProvider } from '@/contexts/SignatureDraftContext';
import { AudioProvider } from '@/contexts/AudioContext';
import { useAdaptiveOrientation } from '@/hooks/useAdaptiveOrientation';
import { CommandAlertProvider } from '@/contexts/CommandAlertContext';
import { useTracker } from '@/hooks/useTracker';
function ThemedNavigator() {
  const { colors } = useTracker();
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}><Stack.Screen name="index" /><Stack.Screen name="(tabs)" /></Stack>;
}
export default function RootLayout() {
  useAdaptiveOrientation();
  return <AlertProvider><SafeAreaProvider><TrackerProvider><SignatureDraftProvider><AudioProvider><CommandAlertProvider><ThemedNavigator /></CommandAlertProvider></AudioProvider></SignatureDraftProvider></TrackerProvider></SafeAreaProvider></AlertProvider>;
}
