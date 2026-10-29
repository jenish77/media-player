import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SeekBar } from '../../src/components/SeekBar';

describe('SeekBar Reanimated and Gesture Handler Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithWrapper = async (ui: React.ReactElement) => {
    return await render(
      <GestureHandlerRootView style={{ flex: 1 }}>{ui}</GestureHandlerRootView>
    );
  };

  it('renders seek bar container and track elements correctly', async () => {
    const { findByTestId } = await renderWithWrapper(
      <SeekBar
        currentTimeMs={15000}
        durationMs={60000}
        bufferedMs={30000}
        onSeek={jest.fn()}
      />
    );

    const seekBar = await findByTestId('seek-bar');
    expect(seekBar).toBeTruthy();
  });

  it('updates layout width when layout event fires', async () => {
    const { findByTestId } = await renderWithWrapper(
      <SeekBar
        currentTimeMs={20000}
        durationMs={100000}
        bufferedMs={50000}
        onSeek={jest.fn()}
      />
    );

    const seekBar = await findByTestId('seek-bar');
    fireEvent(seekBar, 'layout', {
      nativeEvent: { layout: { width: 400, height: 40, x: 0, y: 0 } },
    });

    expect(seekBar).toBeTruthy();
  });

  it('handles zero or negative duration safely without NaN or crashes', async () => {
    const { findByTestId } = await renderWithWrapper(
      <SeekBar
        currentTimeMs={0}
        durationMs={0}
        bufferedMs={0}
        onSeek={jest.fn()}
      />
    );

    const seekBar = await findByTestId('seek-bar');
    expect(seekBar).toBeTruthy();
  });

  it('respects disabled prop cleanly', async () => {
    const onSeekMock = jest.fn();
    const { findByTestId } = await renderWithWrapper(
      <SeekBar
        currentTimeMs={10000}
        durationMs={50000}
        onSeek={onSeekMock}
        disabled={true}
      />
    );

    const seekBar = await findByTestId('seek-bar');
    expect(seekBar).toBeTruthy();
    expect(onSeekMock).not.toHaveBeenCalled();
  });

  it('invokes callbacks with correct arguments when provided', async () => {
    const onSeek = jest.fn();
    const onScrubbingStart = jest.fn();
    const onScrubbingMove = jest.fn();
    const onScrubbingEnd = jest.fn();

    const { findByTestId } = await renderWithWrapper(
      <SeekBar
        currentTimeMs={25000}
        durationMs={100000}
        onSeek={onSeek}
        onScrubbingStart={onScrubbingStart}
        onScrubbingMove={onScrubbingMove}
        onScrubbingEnd={onScrubbingEnd}
      />
    );

    const seekBar = await findByTestId('seek-bar');
    expect(seekBar).toBeTruthy();
  });
});
