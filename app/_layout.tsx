import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { TrackerProvider } from '@/contexts/TrackerContext';
import { AudioProvider } from '@/contexts/AudioContext';
import { useAdaptiveOrientation } from '@/hooks/useAdaptiveOrientation';
import { CommandAlertProvider } from '@/contexts/CommandAlertContext';
import { palettes } from '@/constants/theme';
export default function RootLayout() {
  useAdaptiveOrientation();
  return <AlertProvider><SafeAreaProvider><TrackerProvider><AudioProvider><CommandAlertProvider><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: palettes.dark.background } }}><Stack.Screen name="index" /><Stack.Screen name="(tabs)" /></Stack></CommandAlertProvider></AudioProvider></TrackerProvider></SafeAreaProvider></AlertProvider>;
}
