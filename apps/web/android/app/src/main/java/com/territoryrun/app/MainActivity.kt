package com.territoryrun.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.getcapacitor.Plugin
import com.territoryrun.app.plugins.ExerciseRoutePlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        val samsungPluginClass = if (BuildConfig.HAS_SAMSUNG_HEALTH_SDK) {
            "com.territoryrun.app.plugins.SamsungHealthPlugin"
        } else {
            "com.territoryrun.app.plugins.SamsungHealthPluginStub"
        }
        @Suppress("UNCHECKED_CAST")
        registerPlugin(Class.forName(samsungPluginClass) as Class<out Plugin>)
        registerPlugin(ExerciseRoutePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
