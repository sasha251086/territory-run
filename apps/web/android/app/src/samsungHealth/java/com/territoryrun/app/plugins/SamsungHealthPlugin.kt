package com.territoryrun.app.plugins

import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.samsung.android.sdk.health.data.HealthDataService
import com.samsung.android.sdk.health.data.HealthDataStore
import com.samsung.android.sdk.health.data.permission.AccessType
import com.samsung.android.sdk.health.data.permission.Permission
import com.samsung.android.sdk.health.data.request.DataType
import com.samsung.android.sdk.health.data.request.DataTypes
import com.samsung.android.sdk.health.data.request.LocalTimeFilter
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

@CapacitorPlugin(name = "SamsungHealth")
class SamsungHealthPlugin : Plugin() {

    private var healthDataStore: HealthDataStore? = null

    override fun load() {
        try {
            healthDataStore = HealthDataService.getStore(context)
        } catch (e: Exception) {
            android.util.Log.w("SamsungHealth", "Samsung Health Data SDK unavailable: ${e.message}")
        }
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val result = JSObject()
        result.put("available", healthDataStore != null)
        call.resolve(result)
    }

    @PluginMethod
    fun requestSamsungPermissions(call: PluginCall) {
        val store = healthDataStore
        if (store == null) {
            call.reject("UNAVAILABLE", "Samsung Health not available")
            return
        }

        val permissions = setOf(
            Permission.of(DataTypes.EXERCISE, AccessType.READ),
            Permission.of(DataTypes.EXERCISE_LOCATION, AccessType.READ),
        )

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val alreadyGranted = store.getGrantedPermissions(permissions)
                if (alreadyGranted.containsAll(permissions)) {
                    val result = JSObject()
                    result.put("granted", true)
                    result.put("alreadyGranted", true)
                    call.resolve(result)
                    return@launch
                }

                val requested = withContext(Dispatchers.Main) {
                    store.requestPermissions(permissions, activity)
                }
                val result = JSObject()
                result.put("granted", requested.containsAll(permissions))
                result.put("alreadyGranted", false)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("PERMISSION_ERROR", e.message ?: "Permission request failed")
            }
        }
    }

    @PluginMethod
    fun getExercisesWithLocation(call: PluginCall) {
        val days = call.getInt("days", 14)?.toLong() ?: 14L
        val store = healthDataStore
        if (store == null) {
            call.reject("UNAVAILABLE", "Samsung Health not available")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val endTime = LocalDateTime.now()
                val startTime = endTime.minus(days, ChronoUnit.DAYS)

                val readRequest = DataTypes.EXERCISE.readDataRequestBuilder
                    .setLocalTimeFilter(LocalTimeFilter.of(startTime, endTime))
                    .build()

                val exerciseResult = store.readData(readRequest)
                val workoutsArray = JSArray()
                var sessionsSeen = 0
                var skippedExerciseType = 0
                var skippedNoRoute = 0

                exerciseResult.dataList.forEach { exercisePoint ->
                    val sessions = exercisePoint.getValue(DataType.ExerciseType.SESSIONS)
                        ?: return@forEach

                    sessions.forEach { session ->
                        sessionsSeen += 1
                        val exerciseTypeName = session.exerciseType?.name ?: run {
                            skippedExerciseType += 1
                            return@forEach
                        }
                        if (!isFootExercise(exerciseTypeName)) {
                            skippedExerciseType += 1
                            return@forEach
                        }

                        val route = session.route
                        if (route == null || route.isEmpty()) {
                            skippedNoRoute += 1
                            return@forEach
                        }
                        val trackArray = JSArray()

                        route.forEach { location ->
                            val point = JSObject()
                            point.put("lat", location.latitude.toDouble())
                            point.put("lng", location.longitude.toDouble())
                            point.put("timestamp", location.timestamp.toString())
                            trackArray.put(point)
                        }

                        if (trackArray.length() < 2) return@forEach

                        val sessionStart = session.startTime
                        val sessionEnd = session.endTime

                        val workout = JSObject()
                        workout.put("platformId", "samsung_${sessionStart.toEpochMilli()}")
                        workout.put("startDate", sessionStart.toString())
                        workout.put("endDate", sessionEnd.toString())
                        workout.put("exerciseType", exerciseTypeName)
                        workout.put("distanceMeters", session.distance?.toInt() ?: 0)
                        workout.put("durationSeconds", session.duration.seconds.toInt())
                        workout.put("track", trackArray)
                        workoutsArray.put(workout)
                    }
                }

                val result = JSObject()
                result.put("workouts", workoutsArray)
                result.put("sessionsSeen", sessionsSeen)
                result.put("skippedNoRoute", skippedNoRoute)
                result.put("skippedExerciseType", skippedExerciseType)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("READ_ERROR", e.message ?: "Failed to read Samsung Health data")
            }
        }
    }

    private fun isFootExercise(typeName: String): Boolean {
        val upper = typeName.uppercase()
        return upper.contains("RUN") ||
            upper.contains("WALK") ||
            upper.contains("HIKE") ||
            upper.contains("JOG") ||
            upper.contains("TRAIL") ||
            upper.contains("TREADMILL")
    }
}
