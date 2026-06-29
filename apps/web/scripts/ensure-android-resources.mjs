import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const webRoot = process.cwd();
const resRoot = join(webRoot, 'android', 'app', 'src', 'main', 'res');
const marker = join(resRoot, 'values', 'strings.xml');

if (existsSync(marker)) {
  console.log('Android resources OK');
  process.exit(0);
}

const repoRoot = join(webRoot, '..', '..');
console.log('Missing Android resources, restoring from git...');
const git = spawnSync('git', ['checkout', '--', 'apps/web/android/app/src/main/res'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: true,
});

if (git.status === 0 && existsSync(marker)) {
  console.log('Restored android/app/src/main/res from git');
  process.exit(0);
}

console.log('Git restore unavailable, writing minimal Android resources...');

const files = {
  'values/strings.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Territory Run</string>
    <string name="title_activity_main">Territory Run</string>
    <string name="package_name">com.territoryrun.app</string>
    <string name="custom_url_scheme">com.territoryrun.app</string>
    <string name="health_connect_privacy_policy_url">https://territory-run-cjoj.onrender.com/privacy</string>
</resources>
`,
  'values/colors.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#5b8a72</color>
    <color name="colorPrimaryDark">#466b58</color>
    <color name="colorAccent">#5b8a72</color>
</resources>
`,
  'values/ic_launcher_background.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#F7F4EE</color>
</resources>
`,
  'values/styles.xml': `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.Light.DarkActionBar">
        <item name="colorPrimary">@color/colorPrimary</item>
        <item name="colorPrimaryDark">@color/colorPrimaryDark</item>
        <item name="colorAccent">@color/colorAccent</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/ic_launcher_background</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>
</resources>
`,
  'drawable/ic_launcher_compat.xml': `<?xml version="1.0" encoding="utf-8"?>
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item android:drawable="@drawable/ic_launcher_foreground" />
</layer-list>
`,
  'drawable/splash.xml': `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#F7F4EE" />
</shape>
`,
  'drawable/ic_launcher_foreground.xml': `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <path
        android:fillColor="#5B8A72"
        android:pathData="M54,24c16.6,0 30,13.4 30,30s-13.4,30 -30,30 -30,-13.4 -30,-30 13.4,-30 30,-30z" />
</vector>
`,
  'mipmap-anydpi-v26/ic_launcher.xml': `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`,
  'mipmap-anydpi-v26/ic_launcher_round.xml': `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`,
  'layout/activity_main.xml': `<?xml version="1.0" encoding="utf-8"?>
<androidx.coordinatorlayout.widget.CoordinatorLayout xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:app="http://schemas.android.com/apk/res-auto"
    xmlns:tools="http://schemas.android.com/tools"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    tools:context=".MainActivity">

    <WebView
        android:layout_width="match_parent"
        android:layout_height="match_parent" />
</androidx.coordinatorlayout.widget.CoordinatorLayout>
`,
  'xml/file_paths.xml': `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
    <external-path name="my_images" path="." />
    <cache-path name="my_cache_images" path="." />
</paths>
`,
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = join(resRoot, relPath);
  if (existsSync(fullPath)) continue;
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
  console.log('Wrote', relPath);
}

console.log('Minimal Android resources ready');
