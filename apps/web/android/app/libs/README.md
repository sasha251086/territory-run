# Samsung Health Data SDK

Samsung отдаёт SDK как **ZIP**, внутри — папка `Libs/` с файлом `samsung-health-data-api-1.1.0.aar`.

## Вариант A (рекомендуется): положить ZIP как есть

Скопируйте архив сюда:

```
android/app/libs/samsung-health-data-sdk-1.1.0.zip
```

Gradle **сам распакует** `.aar` при сборке (`extractSamsungHealthSdk` → `preBuild`).

После sync в Android Studio в этой папке также появится `.aar`.

## Вариант B: распаковать вручную

```powershell
cd C:\Projects\territory-run\apps\web\android\app\libs
Expand-Archive -Path samsung-health-data-sdk-1.1.0.zip -DestinationPath _extract -Force
Copy-Item .\_extract\**\*.aar -Destination . -Force
Remove-Item _extract -Recurse -Force
```

Должен появиться файл вроде `samsung-health-data-api-1.1.0.aar`.

## Дальше

1. Android Studio → **Sync Project with Gradle Files**
2. **Build → Rebuild Project**
3. Developer Mode в Samsung Health → пакет `com.territoryrun.app`

Скачать SDK: https://developer.samsung.com/health/data/overview.html
