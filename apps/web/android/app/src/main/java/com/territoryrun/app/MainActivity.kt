package com.territoryrun.app

import android.os.Bundle
import com.getcapacitor.BridgeActivity
import com.territoryrun.app.plugins.ExerciseRoutePlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(ExerciseRoutePlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
