package com.mahecarpool

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

class DeviceLocationModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "DeviceLocation"

  @ReactMethod
  fun getCurrentPosition(promise: Promise) {
    val fine = context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
    val coarse = context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    if (!fine && !coarse) { promise.reject("PERMISSION", "Location permission denied."); return }
    val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    val handler = Handler(Looper.getMainLooper())
    handler.post {
      val providers = listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)
        .filter { manager.isProviderEnabled(it) && (fine || it == LocationManager.NETWORK_PROVIDER) }
      if (providers.isEmpty()) { promise.reject("DISABLED", "Turn on device location or select a landmark."); return@post }
      var finished = false
      lateinit var listener: LocationListener
      lateinit var timeout: Runnable
      fun finish(location: Location?) {
        if (finished) return
        finished = true
        manager.removeUpdates(listener)
        handler.removeCallbacks(timeout)
        if (location == null) promise.reject("TIMEOUT", "No accurate location fix. Select a landmark or retry outdoors.")
        else promise.resolve(Arguments.createMap().apply {
          putDouble("latitude", location.latitude)
          putDouble("longitude", location.longitude)
        })
      }
      listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
          if (location.hasAccuracy() && location.accuracy <= 200 && System.currentTimeMillis() - location.time <= 60000) finish(location)
        }
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
        @Deprecated("Legacy callback")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
      }
      timeout = Runnable { finish(null) }
      handler.postDelayed(timeout, 12000)
      try { providers.forEach { manager.requestLocationUpdates(it, 1000L, 0f, listener, Looper.getMainLooper()) } }
      catch (error: SecurityException) { finish(null) }
    }
  }
}
class DeviceLocationPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(DeviceLocationModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
