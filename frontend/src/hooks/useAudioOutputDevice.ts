import { useCallback, useEffect, useState } from 'react';
import { usePlayerStore } from '@/stores/usePlayerStore';
import { detectAudioOutputDeviceType, type AudioOutputDeviceType } from '@/lib/audioOutputDevice';
import { audioManager } from '@/utils/audioManager';

const DEFAULT_DEVICE_LABEL = 'This web browser';

interface AudioOutputState {
  deviceLabel: string;
  isBluetooth: boolean;
  deviceId: string | null;
  deviceType: AudioOutputDeviceType;
}

const getAudioElement = (): HTMLAudioElement | null => audioManager.getCurrentNodeForOutput();

export const useAudioOutputDevice = (isActive: boolean): AudioOutputState => {
  const preferredOutputId = usePlayerStore((state) => state.audioOutputDevice);
  const [state, setState] = useState<AudioOutputState>({
    deviceLabel: DEFAULT_DEVICE_LABEL,
    isBluetooth: false,
    deviceId: null,
    deviceType: 'browser',
  });

  const updateState = useCallback((next: AudioOutputState) => {
    setState((prev) => {
      if (
        prev.deviceLabel === next.deviceLabel &&
        prev.isBluetooth === next.isBluetooth &&
        prev.deviceId === next.deviceId &&
        prev.deviceType === next.deviceType
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const refreshOutputDevice = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      updateState({
        deviceLabel: DEFAULT_DEVICE_LABEL,
        isBluetooth: false,
        deviceId: null,
        deviceType: 'browser',
      });
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter((device) => device.kind === 'audiooutput');

      if (audioOutputs.length === 0) {
        updateState({
          deviceLabel: DEFAULT_DEVICE_LABEL,
          isBluetooth: false,
          deviceId: null,
          deviceType: 'browser',
        });
        return;
      }

      const audioEl = getAudioElement();
      const sinkId =
        audioEl && 'sinkId' in audioEl
          ? String((audioEl as HTMLAudioElement & { sinkId?: string }).sinkId || '')
          : '';

      let selected =
        (sinkId && sinkId !== 'default'
          ? audioOutputs.find((device) => device.deviceId === sinkId)
          : undefined) ||
        (preferredOutputId
          ? audioOutputs.find((device) => device.deviceId === preferredOutputId)
          : undefined) ||
        audioOutputs.find((device) => detectAudioOutputDeviceType(device.label || '') === 'bluetooth') ||
        audioOutputs.find((device) => device.deviceId === 'default') ||
        audioOutputs[0];

      const rawLabel = (selected?.label || '').trim();
      const outputLabel = rawLabel || DEFAULT_DEVICE_LABEL;
      const deviceType = detectAudioOutputDeviceType(outputLabel);
      const isBluetooth = deviceType === 'bluetooth' || deviceType === 'headphones';

      updateState({
        deviceLabel: outputLabel,
        isBluetooth,
        deviceId: selected?.deviceId || null,
        deviceType,
      });
    } catch {
      updateState({
        deviceLabel: DEFAULT_DEVICE_LABEL,
        isBluetooth: false,
        deviceId: null,
        deviceType: 'browser',
      });
    }
  }, [preferredOutputId, updateState]);

  useEffect(() => {
    if (!isActive) return;

    void refreshOutputDevice();

    const onDeviceChange = () => {
      void refreshOutputDevice();
    };

    navigator.mediaDevices?.addEventListener?.('devicechange', onDeviceChange);

    const poll = window.setInterval(() => {
      void refreshOutputDevice();
    }, 5000);

    return () => {
      navigator.mediaDevices?.removeEventListener?.('devicechange', onDeviceChange);
      window.clearInterval(poll);
    };
  }, [isActive, refreshOutputDevice]);

  return state;
};
