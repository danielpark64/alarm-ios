import '../src/ReactotronConfig';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  return <SafeAreaProvider><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>;
}
