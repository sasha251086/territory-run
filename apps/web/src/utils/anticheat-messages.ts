export function formatAnticheatMessage(reason: string | null): string {
  if (reason === 'SPEED_EXCEEDED') {
    return (
      'GPS-трек содержит нереалистичные скорости. Возможно, вы ехали на велосипеде или в транспорте. ' +
      'Нажмите «Пересчитать», если это была обычная пробежка.'
    );
  }
  if (reason === 'GPS_ANOMALY') {
    return (
      'Трек содержит пропуски или скачки GPS. Проверьте, что приложению разрешён доступ к геолокации ' +
      'и GPS включён на всём маршруте. Можно попробовать «Пересчитать» после исправления трека.'
    );
  }
  if (reason) {
    return `Пробежка отклонена: ${reason}.`;
  }
  return 'Пробежка отклонена системой проверки.';
}

export function canReprocess(reason: string | null): boolean {
  return reason === 'SPEED_EXCEEDED' || reason === 'GPS_ANOMALY';
}
