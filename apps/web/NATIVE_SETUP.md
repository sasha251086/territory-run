# Native (Capacitor) setup — шаги, требующие терминала / Android Studio / Mac

Файловая часть этапа 10 уже сделана в репозитории (конфиг Capacitor, зависимости,
сервис синхронизации, бэкенд-эндпоинт, страница политики). Ниже — команды и нативные
правки, которые нужно выполнить на машине с рабочим терминалом. Все команды — из папки
`apps/web`.

> ВАЖНО (блокер маршрута): плагин `@capgo/capacitor-health` НЕ возвращает GPS-трек
> тренировки (только сводку). Без маршрута клетки не захватываются. Перед публикацией
> нужно решить вопрос источника маршрута — см. раздел «Блокер: GPS-маршрут» внизу.

## 1. Установка и генерация нативных проектов

```bash
cd apps/web
pnpm install                       # подтянет @capacitor/* и @capgo/capacitor-health
npx cap init "Territory Run" "com.territoryrun.app"   # если capacitor.config.ts ещё не подхватился
npx cap add android
npx cap add ios                    # только на Mac с Xcode
pnpm build
npx cap sync
```

Папки `android/` и `ios/` коммитятся в git (кроме сборочных артефактов — они уже в .gitignore).

## 2. Android (Health Connect)

### 2.1 Разрешения в `android/app/src/main/AndroidManifest.xml`
Плагин уже декларирует базовые health-разрешения, но для маршрута добавь:

```xml
<uses-permission android:name="android.permission.health.READ_EXERCISE"/>
<uses-permission android:name="android.permission.health.READ_EXERCISE_ROUTES"/>
```

И activity для экрана обоснования (шаблон берётся из README плагина):

```xml
<activity
  android:name="app.capgo.plugin.health.PermissionsRationaleActivity"
  android:exported="true">
  <intent-filter>
    <action android:name="androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE"/>
  </intent-filter>
</activity>
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
<string>Territory Run читает данные о пробежках, чтобы определить, какие территории ты захватил.</string>
<key>NSHealthUpdateUsageDescription</key>
<string>Territory Run не записывает данные в Apple Health.</string>
```

### 3.2 Xcode
Target → Signing & Capabilities → добавить capability **HealthKit** (Clinical Health
Records НЕ нужен).

## 4. Сборка и запуск

```bash
# Android
pnpm build && npx cap sync && npx cap open android   # запуск из Android Studio

# iOS (Mac)
pnpm build && npx cap sync && npx cap open ios        # запуск из Xcode
```

## 5. Публикация
- Google Play: аккаунт разработчика $25 (разово), AAB, декларация Health Connect,
  публичная ссылка на политику (`/privacy`).
- App Store: Apple Developer Program $99/год, сборка на Mac, ревью с проверкой HealthKit.

---

## Блокер: GPS-маршрут (требует решения до релиза)

`@capgo/capacitor-health` отдаёт только сводку тренировки. Сервис
`src/services/health-sync.service.ts` защитно читает поле `route`, если оно есть, и
пропускает тренировки без маршрута (счётчик `withoutRoute`). Пока источник маршрута не
подключён, синхронизация найдёт тренировки, но импортирует 0 (нет трека → нечего
захватывать).

Варианты решения:
1. Подобрать/форкнуть route-capable плагин (читает `HKWorkoutRoute` на iOS и
   `ExerciseRoute` в Health Connect на Android).
2. Написать небольшой кастомный Capacitor-плагин только для чтения маршрута
   (Kotlin + Swift), а сводку брать из `@capgo/capacitor-health`.

Оценка дополнительной работы по маршруту: ~16–40 часов (нативный код + тесты).
Рекомендуется сначала проверить на одной реальной тренировке Android, что
`ExerciseRoute` действительно доступен через выбранное решение.
