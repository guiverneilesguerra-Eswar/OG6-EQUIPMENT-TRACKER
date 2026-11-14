import Tabs from 'expo-router/tabs';
import { TabNavigation } from '@/components/layout/TabNavigation';
import { palettes } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      backBehavior="history"
      screenOptions={{ headerShown: false, lazy: true, sceneStyle: { backgroundColor: palettes.dark.background } }}
      tabBar={props => <TabNavigation {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'HOME' }} />
      <Tabs.Screen name="withdrawals" options={{ title: 'WITHDRAWALS' }} />
      <Tabs.Screen name="inventory" options={{ title: 'INVENTORY' }} />
      <Tabs.Screen name="reports" options={{ title: 'REPORTS' }} />
      <Tabs.Screen name="settings" options={{ title: 'SETTINGS' }} />
    </Tabs>
  );
}
