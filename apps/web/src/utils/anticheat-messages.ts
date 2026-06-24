export type AnticheatMessage = {
  title: string;
  description: string;
  canRetry: boolean;
};

export const ANTICHEAT_MESSAGES: Record<string, AnticheatMessage> = {
  SPEED_EXCEEDED: {
    title: 'Слишком высокая скорость',
    description:
      'GPS-трек содержит участки со скоростью выше 40 км/ч. Возможно, часть пути вы ехали на транспорте.',
    canRetry: true,
  },
  GPS_ANOMALY: {
    title: 'Проблемы с GPS',
    description:
      'Трек содержит пропуски или аномалии GPS-сигнала. Проверьте разрешения приложения на геолокацию.',
    canRetry: true,
  },
  INSUFFICIENT_POINTS: {
    title: 'Слишком короткий трек',
    description:
      'GPS-трек содержит менее 2 точек. Убедитесь что запись GPS была включена во время пробежки.',
    canRetry: false,
  },
};

const FALLBACK: AnticheatMessage = {
  title: 'Пробежка не прошла проверку',
  description: 'Пробежка не прошла проверку. Обратитесь в поддержку.',
  canRetry: false,
};

export function getAnticheatMessage(reason: string | null): AnticheatMessage {
  if (!reason) return FALLBACK;
  return ANTICHEAT_MESSAGES[reason] ?? FALLBACK;
}

export function formatAnticheatMessage(reason: string | null): string {
  const msg = getAnticheatMessage(reason);
  return `${msg.title}. ${msg.description}`;
}

export function canReprocess(reason: string | null): boolean {
  return getAnticheatMessage(reason).canRetry;
}

/** Re-export for runs formula display */
export const BASE_INFLUENCE_PER_CELL = 1;

export function runsToCaptureFromGap(gap: number): number {
  if (gap <= 0) return 0;
  return Math.ceil(gap / BASE_INFLUENCE_PER_CELL);
}
