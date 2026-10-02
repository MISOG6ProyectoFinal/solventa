import { forwardRef, useCallback, useImperativeHandle, useRef, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../theme';

export type SheetHandle = {
  present: () => void;
  dismiss: () => void;
};

type SheetProps = {
  onClose: () => void;
  testID?: string;
  children: ReactNode;
};

export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet({ onClose, testID, children }, ref) {
  const modal = useRef<BottomSheetModal>(null);
  const insets = useSafeAreaInsets();

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        modal.current?.present();
      },
      dismiss: () => {
        modal.current?.dismiss();
      },
    }),
    [],
  );

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} pressBehavior="close" />
    ),
    [],
  );

  // The window stays full screen, so the sheet moves by the keyboard height.
  return (
    <BottomSheetModal
      ref={modal}
      enableDynamicSizing
      enablePanDownToClose
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustPan"
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      onDismiss={onClose}
    >
      <BottomSheetView
        testID={testID}
        style={[styles.content, { paddingBottom: insets.bottom + theme.space.lg }]}
      >
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.medium,
    borderTopRightRadius: theme.radius.medium,
  },
  handle: {
    backgroundColor: theme.colors.border,
  },
  content: {
    paddingTop: theme.space.sm,
    paddingHorizontal: theme.space.lg,
    gap: theme.space.sm,
  },
});
