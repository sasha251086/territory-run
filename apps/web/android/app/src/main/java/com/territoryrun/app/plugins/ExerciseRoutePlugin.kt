package com.territoryrun.app.plugins

import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.contracts.ExerciseRouteRequestContract
import androidx.health.connect.client.records.ExerciseRouteResult
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.temporal.ChronoUnit

@CapacitorPlugin(name = "ExerciseRoute")
class ExerciseRoutePlugin : Plugin() {

    private var healthConnectClient: HealthConnectClient? = null
    private var routeRequestLauncher: androidx.activity.result.ActivityResultLauncher<String>? = null

    private var pendingCall: PluginCall? = null
    private var pendingRecordId: String? = null

    override fun load() {
        val ctx = context
        if (HealthConnectClient.getSdkStatus(ctx) == HealthConnectClient.SDK_AVAILABLE) {
            healthConnectClient = HealthConnectClient.getOrCreate(ctx)
        }

        routeRequestLauncher = activity.registerForActivityResult(ExerciseRouteRequestContract()) { route ->
            val call = pendingCall ?: return@registerForActivityResult
            pendingCall = null
            val recordId = pendingRecordId
            pendingRecordId = null

            if (route == null) {
                call.reject("USER_DENIED", "User denied route access")
                return@registerForActivityResult
            }

            val result = JSObject()
            result.put("recordId", recordId)
            result.put("points", routeToJsArray(route.route))
            call.resolve(result)
        }
    }

    @PluginMethod
    fun requestRoute(call: PluginCall) {
        val recordId = call.getString("recordId")
        if (recordId == null) {
            call.reject("INVALID_ARGS", "recordId is required")
            return
        }

        val client = healthConnectClient
        if (client == null) {
            call.reject("UNAVAILABLE", "Health Connect not available")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = client.readRecord(ExerciseSessionRecord::class, recordId)

                when (val routeResult = response.record.exerciseRouteResult) {
                    is ExerciseRouteResult.Data -> {
                        val result = JSObject()
                        result.put("recordId", recordId)
                        result.put("points", routeToJsArray(routeResult.exerciseRoute.route))
                        call.resolve(result)
                    }

                    is ExerciseRouteResult.ConsentRequired -> {
                        activity.runOnUiThread {
                            pendingCall = call
                            pendingRecordId = recordId
                            val launcher = routeRequestLauncher
                            if (launcher == null) {
                                pendingCall = null
                                pendingRecordId = null
                                call.reject("LAUNCHER_ERROR", "Route launcher not initialized")
                            } else {
                                launcher.launch(recordId)
                            }
                        }
                    }

                    is ExerciseRouteResult.NoData -> {
                        val result = JSObject()
                        result.put("recordId", recordId)
                        result.put("points", JSArray())
                        call.resolve(result)
                    }

                    else -> {
                        call.reject("UNKNOWN", "Unexpected route result type")
                    }
                }
            } catch (e: Exception) {
                call.reject("READ_ERROR", e.message ?: "Failed to read record")
            }
        }
    }

    @PluginMethod
    fun getExerciseSessions(call: PluginCall) {
        val days = call.getInt("days", 14)!!.toLong()
        val client = healthConnectClient
        if (client == null) {
            call.reject("UNAVAILABLE", "Health Connect not available")
            return
        }

        CoroutineScope(Dispatchers.IO).launch {
            try {
                val endTime = Instant.now()
                val startTime = endTime.minus(days, ChronoUnit.DAYS)

                val response = client.readRecords(
                    ReadRecordsRequest(
                        ExerciseSessionRecord::class,
                        TimeRangeFilter.between(startTime, endTime),
                    ),
                )

                val sessions = JSArray()
                response.records.forEach { record ->
                    val session = JSObject()
                    session.put("recordId", record.metadata.id)
                    session.put("startDate", record.startTime.toString())
                    session.put("endDate", record.endTime.toString())
                    session.put("exerciseType", record.exerciseType)
                    session.put(
                        "hasRoute",
                        record.exerciseRouteResult is ExerciseRouteResult.Data ||
                            record.exerciseRouteResult is ExerciseRouteResult.ConsentRequired,
                    )
                    sessions.put(session)
                }

                val result = JSObject()
                result.put("sessions", sessions)
                call.resolve(result)
            } catch (e: Exception) {
                call.reject("READ_ERROR", e.message ?: "Failed to read sessions")
            }
        }
    }

    private fun routeToJsArray(locations: List<androidx.health.connect.client.records.ExerciseRoute.Location>): JSArray {
        val pointsArray = JSArray()
        locations.forEach { location ->
            val point = JSObject()
            point.put("lat", location.latitude)
            point.put("lng", location.longitude)
            point.put("timestamp", location.time.toString())
            location.altitude?.let { point.put("altitude", it.inMeters) }
            pointsArray.put(point)
        }
        return pointsArray
    }
}
