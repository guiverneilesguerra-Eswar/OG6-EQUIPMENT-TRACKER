// Use the device's normal rotation policy instead of forcing landscape.
// iOS starts upright via app.json; both native platforms can rotate normally.
export async function enableAdaptiveOrientation(): Promise<void> {
  const orientation = await import('expo-screen-orientation');
  await orientation.unlockAsync();
}
