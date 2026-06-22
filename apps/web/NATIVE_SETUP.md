# Native (Capacitor) setup — шаги, требующие терминала / Android Studio / Mac

Файловая часть этапа 10 готова в репозитории (конфиг Capacitor, зависимости,
сервис синхронизации с чтением GPS-маршрута, бэкенд-эндпоинт, страница политики).
Ниже — команды и нативные правки, которые нужно выполнить на машине с рабочим
терминалом. Все команды — из папки `apps/web`.

> Маршрут решён: используется плагин `capacitor-health` (mley). Он читает GPS-трек
> тренировки через `queryWorkouts({ includeRoute: true })` — на iOS из `HKWorkoutRoute`,
> на Android из `ExerciseRoute` в Health Connect. Сервис `health-sync.service.ts` уже
> отправляет точки маршрута на `/activities/import-native`, и клетки захватываются.

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

И activity для экрана обоснования (intent-filter Health Connect):

```xml
<activity
  android:name="io.ionic.starter.PermissionsRationaleActivity"
  android:exported="true">
  <intent-filter>
    <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"/>
  </intent-filter>
</activity>
```

(Точный путь activity для шаблона обоснования смотри в README плагина `capacitor-health`
для своей версии — он может отличаться именем пакета.)

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
1. Запиши короткую уличную пробежку с GPS (часы/телефон → Health Connect или Apple Health).
2. В приложении: «Синхронизировать пробежки».
3. Ожидаемо: `imported >= 1`, на карте появляются захваченные клетки.
4. Тренировка на дорожке/в зале без GPS попадёт в `withoutRoute` — это нормально,
   территорию захватывает только уличный трек.

## 6. Публикация
- Google Play: аккаунт разработчика $25 (разово), AAB, декларация Health Connect,
  публичная ссылка на политику (`/privacy`).
- App Store: Apple Developer Program $99/год, сборка на Mac, ревью с проверкой HealthKit
  (опиши, что маршрут используется для игровой механики захвата территорий).
