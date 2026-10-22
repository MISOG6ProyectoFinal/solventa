import { createRef } from 'react';
import { render } from '@testing-library/react-native';

import { AppText } from './AppText';
import { Sheet, type SheetHandle } from './Sheet';

const mockModal = { present: jest.fn(), dismiss: jest.fn() };
let mockOnDismiss: (() => void) | undefined;

// The library gets stuck if it is asked to dismiss a sheet that is not open, so the calls are counted.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');

  return {
    BottomSheetModal: React.forwardRef(
      (props: { onDismiss?: () => void }, ref: React.Ref<typeof mockModal>) => {
        React.useImperativeHandle(ref, () => mockModal);
        mockOnDismiss = props.onDismiss;
        return null;
      },
    ),
    BottomSheetView: ({ children }: { children?: unknown }) => children,
    BottomSheetBackdrop: () => null,
  };
});

async function renderSheet(onClose = jest.fn()) {
  const ref = createRef<SheetHandle>();
  await render(
    <Sheet ref={ref} onClose={onClose}>
      <AppText>Contenido</AppText>
    </Sheet>,
  );
  const handle = ref.current;
  if (!handle) {
    throw new Error('The sheet handle was not set');
  }
  return { handle, onClose };
}

describe('Sheet', () => {
  beforeEach(() => {
    mockModal.present.mockClear();
    mockModal.dismiss.mockClear();
  });

  it('does not ask the library to dismiss a sheet that was never opened', async () => {
    const { handle } = await renderSheet();

    handle.dismiss();

    expect(mockModal.dismiss).not.toHaveBeenCalled();
  });

  it('dismisses a sheet that is open', async () => {
    const { handle } = await renderSheet();

    handle.present();
    handle.dismiss();

    expect(mockModal.present).toHaveBeenCalledTimes(1);
    expect(mockModal.dismiss).toHaveBeenCalledTimes(1);
  });

  it('forgets that it was open once it is closed, whoever closed it', async () => {
    const { handle, onClose } = await renderSheet();

    handle.present();
    mockOnDismiss?.();
    handle.dismiss();

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockModal.dismiss).not.toHaveBeenCalled();
  });
});
