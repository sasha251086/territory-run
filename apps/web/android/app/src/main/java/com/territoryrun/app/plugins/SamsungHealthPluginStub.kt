package com.territoryrun.app.plugins

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

/**
 * Fallback when Samsung Health Data SDK .aar is not in android/app/libs/.
 * Replace by adding the .aar and syncing Gradle — build will pick SamsungHealthPlugin instead.
 */
@CapacitorPlugin(name = "SamsungHealth")
class SamsungHealthPluginStub : Plugin() {

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        result.put("available", false)
        call.resolve(result)
    }

    @PluginMethod
    fun requestSamsungPermissions(call: PluginCall) {
        call.reject("UNAVAILABLE", "Samsung Health Data SDK not installed — add .aar to android/app/libs/")
    }

    @PluginMethod
    fun getExercisesWithLocation(call: PluginCall) {
        val result = JSObject()
        result.put("workouts", JSArray())
        call.resolve(result)
    }
}
