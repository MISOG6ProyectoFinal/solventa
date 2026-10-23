import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigation from '../navigation/RootNavigation';
import { useLanguageStore } from '../shared/i18n/useLanguageStore';

export default function App() {
  const loaded = useLanguageStore((state) => state.loaded);
  const loadLanguage = useLanguageStore((state) => state.load);

  useEffect(() => {
    void loadLanguage();
  }, [loadLanguage]);

  // Waiting for the saved choice avoids a first frame in the wrong language.
  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <RootNavigation />
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
