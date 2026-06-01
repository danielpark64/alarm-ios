import Reactotron from 'reactotron-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

if (__DEV__) {
  Reactotron
    .setAsyncStorageHandler(AsyncStorage)
    .configure({
      name: '알람앱',
      host: 'localhost',
    })
    .useReactNative({
      asyncStorage: { ignore: [] },
      networking: { ignoreUrls: /symbolicate/ },
      errors: { veto: () => false },
      overlay: false,
    })
    .connect();

  // console.log → Reactotron으로 리다이렉트
  const originalLog = console.log.bind(console);
  console.log = (...args: any[]) => {
    Reactotron.log?.(...args);
    originalLog(...args);
  };
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: any[]) => {
    Reactotron.warn?.(...args);
    originalWarn(...args);
  };
}
