# Игровые константы (источник правды)

Значения синхронизированы с `apps/api/src/common/constants.ts` и `apps/web/src/constants/game.ts`.

| Константа | Значение | Описание |
|-----------|----------|----------|
| `INFLUENCE_DISPLAY_SCALE` | 100 | UI показывает internal ÷ 100 (7800 → 78) |
| `H3_RESOLUTION` | 9 | ~174 м² на клетку |
| `BASE_INFLUENCE` | 100 | Базовое влияние за пробежку в клетке (UI: +1) |
| `MAX_INFLUENCE_PER_CELL` | 10 000 | Потолок влияния (UI: 100) |
| `MAX_INFLUENCE_GAIN_MULTIPLIER` | ×1.5 | Потолок стека множителей за визит |
| `MIN_CELL_DISTANCE_M` | 50 | Мин. метров в клетке для полного прироста |
| `MIN_ACTIVITY_DISTANCE_M` | 100 | Мин. дистанция пробежки |
| `HOME_ZONE_RADIUS_M` | 350 | Радиус домашней базы |
| `HOME_ZONE_BONUS_MULTIPLIER` | ×1.25 | Бонус в домашней зоне |
| `NEW_PLAYER_BONUS_MULTIPLIER` | ×1.25 | Бонус новичка (30 дней) |
| `DECAY_RATE_PER_DAY` | 0.98 | −2% от текущего влияния после grace period |
| `DECAY_GRACE_DAYS` | 7 | Нет decay, если пробежка через клетку была недавно |
| `DECAY_DELETE_AFTER_DAYS` | 60 | Удаление влияния без активности в клетке |
| `DECAY_WARNING_DAYS` | 7 | Порог «нужна пробежка» на карте |
| `DECAY_THREAT_DAYS` | 10 | Порог «критично» на карте |
| `SOFT_CAP_CELLS` | 80 | Soft cap по числу клеток |
| `SOFT_CAP_INFLUENCE_MULTIPLIER` | ×0.5 | Множитель влияния после cap |
| `CAPTURE_TARGET_RADIUS_M` | 2000 | Радиус поиска целей |
| `CAPTURE_TARGET_MAX_GAP` | 1500 | Макс. разрыв для «захватить» (UI: 15) |
| `CAPTURE_TARGET_FINISH_GAP` | 500 | Порог «добить» (UI: 5) |
| `CONTEST_GAP_ABSOLUTE` | 100 | Абс. порог спора (UI: 1) |
| `streakMultiplier` | 1.0 / 1.1 / 1.2 / 1.3 | Бонус стрика (4+/7+/14+ дней) |

_Обновлено: 27 июня 2026_
