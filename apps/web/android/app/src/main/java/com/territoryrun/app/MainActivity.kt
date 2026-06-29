package com.territoryrun.app

import android.content.Context
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.CookieManager
import android.webkit.WebSettings
import android.webkit.WebStorage
import android.widget.Toast
import com.getcapacitor.BridgeActivity
import com.getcapacitor.Plugin
import com.territoryrun.app.plugins.ExerciseRoutePlugin
import com.territoryrun.app.plugins.SamsungHealthPluginStub

/**
 * Thin shell: always show the live website (same content as browser / PWA).
 */
class MainActivity : BridgeActivity() {
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onCreate(savedInstanceState: Bundle?) {
        try {
            val samsungPluginClass = if (BuildConfig.HAS_SAMSUNG_HEALTH_SDK) {
                "com.territoryrun.app.plugins.SamsungHealthPlugin"
            } else {
                "com.territoryrun.app.plugins.SamsungHealthPluginStub"
            }
            @Suppress("UNCHECKED_CAST")
            registerPlugin(Class.forName(samsungPluginClass) as Class<out Plugin>)
        } catch (e: Throwable) {
            registerPlugin(SamsungHealthPluginStub::class.java)
        }

        registerPlugin(ExerciseRoutePlugin::class.java)
        super.onCreate(savedInstanceState)

        val prefs = getSharedPreferences("territory_run", Context.MODE_PRIVATE)
        val lastVersion = prefs.getInt("web_cache_version_code", 0)
        if (lastVersion != BuildConfig.VERSION_CODE) {
            wipeWebViewStorage()
            prefs.edit().putInt("web_cache_version_code", BuildConfig.VERSION_CODE).apply()
        }

        configureWebView()
        openLiveWebsite(showToast = true)
    }

    override fun onResume() {
        super.onResume()
        mainHandler.postDelayed({ ensureLiveWebsite() }, 400)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    private fun configureWebView() {
        val webView = bridge.webView
        webView.settings.apply {
            cacheMode = WebSettings.LOAD_NO_CACHE
            domStorageEnabled = true
        }
    }

    private fun openLiveWebsite(showToast: Boolean) {
        val url = liveWebsiteUrl()
        bridge.webView.loadUrl(url)
        if (showToast) {
            Toast.makeText(
                this,
                "Territory Run ${BuildConfig.VERSION_NAME} → Render",
                Toast.LENGTH_LONG,
            ).show()
        }
    }

    private fun ensureLiveWebsite() {
        val webView = bridge.webView
        val current = webView.url.orEmpty()
        if (current.contains(LIVE_HOST)) return

        wipeWebViewStorage()
        openLiveWebsite(showToast = false)
    }

    private fun wipeWebViewStorage() {
        val webView = bridge.webView
        webView.clearCache(true)
        webView.clearHistory()
        webView.clearFormData()
        WebStorage.getInstance().deleteAllData()
        val cookieManager = CookieManager.getInstance()
        cookieManager.setAcceptCookie(true)
        cookieManager.removeAllCookies(null)
        cookieManager.flush()
    }

    private fun liveWebsiteUrl(): String {
        val base = BuildConfig.LIVE_WEB_URL.trimEnd('/')
        return "$base/?native=1&v=${BuildConfig.VERSION_CODE}&t=${System.currentTimeMillis()}"
    }

    companion object {
        private const val LIVE_HOST = "territory-run-cjoj.onrender.com"
    }
}
