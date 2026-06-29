package com.territoryrun.app

import android.app.Application
import android.os.Build
import android.webkit.WebView

class TerritoryRunApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Fresh WebView storage per APK version — avoids stale UI from old installs.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WebView.setDataDirectorySuffix("tr-v${BuildConfig.VERSION_CODE}")
        }
    }
}
