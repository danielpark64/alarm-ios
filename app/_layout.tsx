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
import { LanguageProvider } from '../src/i18n';
LogBox.ignoreAllLogs();
SplashScreen.preventAutoHideAsync();
export default function RootLayout() {
  useEffect(() => { SplashScreen.hideAsync(); }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AlarmDefaultsProvider>
          <FontScaleProvider>
            <LanguageProvider>
              <SafeAreaProvider><Stack screenOptions={{ headerShown: false }} /></SafeAreaProvider>
            </LanguageProvider>
          </FontScaleProvider>
        </AlarmDefaultsProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
