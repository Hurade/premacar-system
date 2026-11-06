import React, { createContext, useContext, useState } from 'react';

export type NotificationSoundType = 'padrao' | 'suave' | 'dupla' | 'campainha';

export const SOUND_TYPE_LABELS: Record<NotificationSoundType, string> = {
  padrao: 'Padrão',
  suave: 'Suave',
  dupla: 'Dupla nota',
  campainha: 'Campainha',
};

interface NotificationSettingsValue {
  enabled: boolean;
  volume: number; // 0-100
  soundType: NotificationSoundType;
  setEnabled: (value: boolean) => void;
  setVolume: (value: number) => void;
  setSoundType: (value: NotificationSoundType) => void;
  playTestSound: () => void;
}

const STORAGE_KEY = 'premacar-notification-settings';

interface StoredSettings {
  enabled: boolean;
  volume: number;
  soundType: NotificationSoundType;
}

const DEFAULTS: StoredSettings = { enabled: true, volume: 70, soundType: 'padrao' };

function getInitialSettings(): StoredSettings {
  if (typeof window === 'undefined') return DEFAULTS;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;
    const parsed = JSON.parse(stored);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULTS.enabled,
      volume: typeof parsed.volume === 'number' ? parsed.volume : DEFAULTS.volume,
      soundType: SOUND_TYPE_LABELS[parsed.soundType as NotificationSoundType] ? parsed.soundType : DEFAULTS.soundType,
    };
  } catch {
    return DEFAULTS;
  }
}

function persist(settings: StoredSettings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage indisponível (modo privado, etc.) — perde persistência, sem quebrar a troca de preferência
  }
}

// Gera o tom via Web Audio API — mesma lógica usada tanto para a
// notificação real (useConversations.ts) quanto pro botão "Testar som"
// aqui nas configurações, pra garantir que o preview é fiel ao que toca de
// verdade.
export function playNotificationSound(opts?: { volume?: number; soundType?: NotificationSoundType }) {
  const volume = opts?.volume ?? DEFAULTS.volume;
  const soundType = opts?.soundType ?? DEFAULTS.soundType;

  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const peak = Math.max(0, Math.min(1, volume / 100)) * 0.3; // 0.3 = pico original (volume 100%)

    const tone = (freq: number, type: OscillatorType, startOffset: number, duration: number, gainPeak: number) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const start = audioContext.currentTime + startOffset;
      oscillator.frequency.setValueAtTime(freq, start);
      oscillator.type = type;

      gainNode.gain.setValueAtTime(gainPeak, start);
      gainNode.gain.exponentialRampToValueAtTime(0.01, start + duration);

      oscillator.start(start);
      oscillator.stop(start + duration);
    };

    switch (soundType) {
      case 'suave':
        tone(523.25, 'sine', 0, 0.5, peak * 0.8); // C5, mais longo e mais suave
        break;
      case 'dupla':
        tone(880, 'sine', 0, 0.15, peak);
        tone(1046.5, 'sine', 0.18, 0.2, peak); // C6
        break;
      case 'campainha':
        tone(1318.5, 'triangle', 0, 0.4, peak * 0.8); // E6
        tone(1046.5, 'triangle', 0.05, 0.35, peak * 0.5); // C6, harmônico
        break;
      case 'padrao':
      default:
        tone(880, 'sine', 0, 0.3, peak); // A5 — som original do sistema
    }

    console.log('[Notification] 🔔 Sound played:', soundType, 'volume:', volume);
  } catch (error) {
    console.log('[Notification] Could not play sound:', error);
  }
}

const NotificationSettingsContext = createContext<NotificationSettingsValue | undefined>(undefined);

export const NotificationSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<StoredSettings>(getInitialSettings);

  const update = (partial: Partial<StoredSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...partial };
      persist(next);
      return next;
    });
  };

  const value: NotificationSettingsValue = {
    enabled: settings.enabled,
    volume: settings.volume,
    soundType: settings.soundType,
    setEnabled: (value) => update({ enabled: value }),
    setVolume: (value) => update({ volume: value }),
    setSoundType: (value) => update({ soundType: value }),
    playTestSound: () => playNotificationSound({ volume: settings.volume, soundType: settings.soundType }),
  };

  return (
    <NotificationSettingsContext.Provider value={value}>
      {children}
    </NotificationSettingsContext.Provider>
  );
};

export function useNotificationSettings(): NotificationSettingsValue {
  const ctx = useContext(NotificationSettingsContext);
  if (!ctx) throw new Error('useNotificationSettings deve ser usado dentro de um NotificationSettingsProvider');
  return ctx;
}
