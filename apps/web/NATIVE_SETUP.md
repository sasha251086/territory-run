# Native (Capacitor) setup — шаги, требующие терминала / Android Studio / Mac

Файловая часть этапа 10 готова в репозитории (конфиг Capacitor, зависимости,
сервис синхронизации с чтением GPS-маршрута, бэкенд-эндпоинт, страница политики).
Ниже — команды и нативные правки, которые нужно выполнить на машине с рабочим
терминалом. Все команды — из папки `apps/web`.

> **Android GPS-маршрут (этап 11):** Samsung Health отдаёт в Health Connect только сводку
> тренировок. GPS доступен после системного диалога согласия на каждую тренировку.
> Кастомный плагин `ExerciseRoutePlugin.kt` в `android/app/.../plugins/` вызывает
> `ExerciseRouteRequestContract` — см. `health-sync.service.ts` → `syncWithConsentFlow()`.
> На iOS по-прежнему достаточно `capacitor-health`.

## 1. Установка и генерация нативных проектов

```bash
cd apps/web
pnpm install                       # подтянет @capacitor/* и capacitor-health
npx cap init "Territory Run" "com.territoryrun.app"   # если capacitor.config.ts ещё не подхватился
npx cap add android
npx cap add ios                    # только на Mac с Xcode
pnpm build
npx cap sync
```

Папки `android/` и `ios/` коммитятся в git (кроме сборочных артефактов — они уже в .gitignore).

## 2. Android (Health Connect)

### 2.1 Разрешения в `android/app/src/main/AndroidManifest.xml`
Плагин декларирует базовые health-разрешения. Убедись, что для тренировок и маршрута
присутствуют (в корне `<manifest>`, сразу после открывающего тега):

```xml
<!-- Видимость Health Connect -->
<queries>
  <package android:name="com.google.android.apps.healthdata" />
</queries>

<uses-permission android:name="android.permission.health.READ_STEPS" />
<uses-permission android:name="android.permission.health.READ_DISTANCE" />
<uses-permission android:name="android.permission.health.READ_EXERCISE" />
<uses-permission android:name="android.permission.health.READ_EXERCISE_ROUTE" />
<uses-permission android:name="android.permission.health.READ_HEART_RATE" />
```

> Примечание: `READ_EXERCISE_ROUTE` (единственное число) — это per-session маршрут,
> его пользователь выдаёт в обычном диалоге Health Connect. Не путать с
> `READ_EXERCISE_ROUTES` (всех тренировок) — оно выдаётся только вручную в настройках
> Health Connect и нам не требуется.

И activity/alias обоснования (их класс уже поставляется плагином `capacitor-health`,
нужно только сослаться). Внутри тега `<application>`:

```xml
<!-- Android ≤13 -->
<activity
  android:name="com.fit_up.health.capacitor.PermissionsRationaleActivity"
  android:exported="true">
  <intent-filter>
    <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE" />
  </intent-filter>
</activity>

<!-- Android 14+ -->
<activity-alias
  android:name="ViewPermissionUsageActivity"
  android:exported="true"
  android:targetActivity="com.fit_up.health.capacitor.PermissionsRationaleActivity"
  android:permission="android.permission.START_VIEW_PERMISSION_USAGE">
  <intent-filter>
    <action android:name="android.intent.action.VIEW_PERMISSION_USAGE" />
    <category android:name="android.intent.category.HEALTH_PERMISSIONS" />
  </intent-filter>
</activity-alias>
```

### 2.2 Ссылка на политику конфиденциальности
В `android/app/src/main/res/values/strings.xml`:

```xml
<string name="health_connect_privacy_policy_url">https://territory-run-cjoj.onrender.com/privacy</string>
```

(Страница `/privacy` уже есть в веб-приложении.)

## 3. iOS (HealthKit) — только на Mac

### 3.1 `ios/App/App/Info.plist`
```xml
<key>NSHealthShareUsageDescription</key>
<string>Territory Run читает данные о пробежках и их GPS-маршрут, чтобы определить, какие территории ты захватил.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Territory Run не записывает данные в Apple Health.</string>
```

### 3.2 Xcode
Target → Signing & Capabilities → добавить capability **HealthKit** (Clinical Health
Records НЕ нужен). HealthKit автоматически включает доступ к маршрутам тренировок при
запросе соответствующих разрешений.

## 4. Сборка и запуск

```bash
# Android
pnpm build && npx cap sync && npx cap open android   # запуск из Android Studio

# iOS (Mac)
pnpm build && npx cap sync && npx cap open ios        # запуск из Xcode
```

## 5. Проверка маршрута (важно сделать на реальной тренировке)
1. **Пересобери APK** после любых изменений в `android/` (плагин `ExerciseRoute` — нативный код):
   `npx cap sync android` → Android Studio → Build APK(s).
2. Запиши короткую уличную пробежку с GPS (часы/телефон → Health Connect или Apple Health).
3. В приложении: «Синхронизировать пробежки» → подтверди предупреждение → для каждой
   тренировки Android покажет системный диалог «Разрешить доступ к маршруту».
4. Ожидаемо: `imported >= 1`, на карте появляются захваченные клетки.
5. Повторная синхронизация не показывает диалоги (уже импортированные пропускаются).
6. Тренировка на дорожке/в зале без GPS попадёт в `withoutRoute` — это нормально.

## 7. Samsung Health Data SDK (этап 12 — прямой GPS без Health Connect)

Samsung Health **не передаёт GPS** в Health Connect. Для Android добавлен плагин
`SamsungHealthPlugin.kt`, который читает маршруты напрямую из Samsung Health Data SDK v1.1.0.

### 7.1 Скачать SDK

1. https://developer.samsung.com/health/data/overview.html
2. Скачать **Samsung Health Data SDK v1.1.0** — это **ZIP** (не `.aar` напрямую)
3. Положить ZIP в `android/app/libs/`, например:
   `samsung-health-data-sdk-1.1.0.zip`
4. Gradle сам извлечёт `Libs/samsung-health-data-api-1.1.0.aar` при сборке.
   Или распакуйте вручную — см. `android/app/libs/README.md`

### 7.2 Developer Mode в Samsung Health (до публикации в Google Play)

1. Samsung Health → Профиль → ⋮ → Настройки
2. «Сведения о Samsung Health» → нажать номер версии **10 раз**
3. Включить **Developer Mode (Samsung Health Data SDK)**
4. Добавить пакет: `com.territoryrun.app`

### 7.3 Сборка

```bash
cd apps/web
pnpm build
npx cap sync android
npx cap open android
```

### 7.4 Проверка на устройстве

1. Установить APK на **реальный Samsung** (эмулятор не поддерживается)
2. Samsung Health **6.30.2+**
3. «Синхронизировать пробежки» → диалог разрешений **Samsung Health** (не Health Connect)
4. Уличная пробежка с GPS должна импортироваться с источником `Samsung Health`
5. Повторная синхронизация не создаёт дублей

Если SDK недоступен (нет Samsung Health, Developer Mode выключен) — автоматически
используется Health Connect (этап 10/11) или ZIP-импорт.

## 8. Публикация
- Google Play: аккаунт разработчика $25 (разово), AAB, декларация Health Connect,
  публичная ссылка на политику (`/privacy`).
- App Store: Apple Developer Program $99/год, сборка на Mac, ревью с проверкой HealthKit
  (опиши, что маршрут используется для игровой механики захвата территорий).
