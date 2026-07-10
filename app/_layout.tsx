import '../src/ReactotronConfig';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { LogBox } from 'react-native';
import { ThemeProvider } from '../src/hooks/useTheme';
import { AlarmDefaultsProvider } from '../src/hooks/useAlarmDefaults';
import { FontScaleProvider } from '../src/hooks/useFontScale';
LogBox.ignoreAllLogs();
SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AlarmDefaultsProvider>
          <FontScaleProvider>
            <SafeAreaProvider><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>
          </FontScaleProvider>
        </AlarmDefaultsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
