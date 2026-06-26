# Игровые константы (источник правды)

Значения синхронизированы с `apps/api/src/common/constants.ts` и `apps/web/src/constants/game.ts`.

| Константа | Значение | Описание |
|-----------|----------|----------|
| `H3_RESOLUTION` | 9 | ~174 м² на клетку |
| `BASE_INFLUENCE` | 1 | Базовое влияние за пробежку в клетке |
| `MAX_INFLUENCE_PER_CELL` | 100 | Потолок влияния на клетку |
| `MAX_INFLUENCE_GAIN_MULTIPLIER` | ×1.5 | Потолок стека множителей за визит |
| `MIN_CELL_DISTANCE_M` | 50 | Мин. метров в клетке для полного +1 |
| `MIN_ACTIVITY_DISTANCE_M` | 100 | Мин. дистанция пробежки |
| `HOME_ZONE_RADIUS_M` | 350 | Радиус домашней базы |
| `HOME_ZONE_BONUS_MULTIPLIER` | ×1.25 | Бонус в домашней зоне |
| `NEW_PLAYER_BONUS_MULTIPLIER` | ×1.25 | Бонус новичка (30 дней) |
| `DECAY_RATE_PER_DAY` | ×0.98 | Ежедневное затухание |
| `DECAY_DELETE_AFTER_DAYS` | 60 | Удаление влияния без активности |
| `DECAY_WARNING_DAYS` | 7 | Порог «риск» на карте |
| `DECAY_THREAT_DAYS` | 10 | Порог «критично» на карте |
| `SOFT_CAP_CELLS` | 80 | Soft cap по числу клеток |
| `SOFT_CAP_INFLUENCE_MULTIPLIER` | ×0.5 | Множитель влияния после cap |
| `CAPTURE_TARGET_RADIUS_M` | 2000 | Радиус поиска целей |
| `CAPTURE_TARGET_MAX_GAP` | 15 | Макс. разрыв для «захватить» |
| `CAPTURE_TARGET_FINISH_GAP` | 5 | Порог «добить» |
| `CAPTURE_TARGET_EXPAND_LIMIT` | 5 | Макс. целей «расширить» |
| `MAX_RUN_SPEED_MS` | ~7.78 m/s (28 km/h) | Античит скорости |
| `homeAreaLabel` | геокод OSM | Название района базы (Nominatim) |
| `STREAK_BREAK_DAYS` | 2 | Сброс стрика без бега |
| `streakMultiplier` | 1.0 / 1.1 / 1.2 / 1.3 | Бонус стрика (4+/7+/14+ дней) |

_Обновлено: 25 июня 2026_
