package expo.modules.bobnative

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import org.json.JSONArray
import org.json.JSONObject

class WatchConfig : Record {
  @Field val packages: List<String> = emptyList()
  @Field val labels: Map<String, String> = emptyMap()
  @Field val countdownSeconds: Int = 180
  @Field val cooldownMinutes: Int = 10
  @Field val alarmEnabled: Boolean = true
  @Field val alarmTitle: String = "Close it."
  @Field val alarmBody: String = "Bob said close {app}."
}

class BobNativeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private fun startSettings(intent: Intent) {
    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
  }

  override fun definition() = ModuleDefinition {
    Name("BobNative")

    Function("getAlarmSupport") { "alarmmanager" }

    Function("hasUsageAccess") { UsageAccess.hasAccess(context) }

    Function("openUsageAccessSettings") {
      startSettings(Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS))
    }

    AsyncFunction("getTodayUsageMinutes") { packages: List<String> ->
      UsageAccess.todayMinutes(context, packages)
    }

    AsyncFunction("resolvePackagesByLabel") { labels: List<String> ->
      UsageAccess.resolveByLabel(context, labels)
    }

    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        context.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
      } else {
        true
      }
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startSettings(
          Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
        )
      }
    }

    AsyncFunction("startDistractionWatch") { config: WatchConfig ->
      val json = JSONObject()
        .put("packages", JSONArray(config.packages))
        .put("labels", JSONObject(config.labels))
        .put("countdownSeconds", config.countdownSeconds)
        .put("cooldownMinutes", config.cooldownMinutes)
        .put("alarmEnabled", config.alarmEnabled)
        .put("alarmTitle", config.alarmTitle)
        .put("alarmBody", config.alarmBody)
      // Notification channels and VibrationEffect used by the service need Android 8+.
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return@AsyncFunction false
      DistractionWatchService.saveConfig(context, json)
      context.startForegroundService(Intent(context, DistractionWatchService::class.java))
      true
    }

    AsyncFunction("stopDistractionWatch") {
      context.stopService(Intent(context, DistractionWatchService::class.java))
    }

    Function("isDistractionWatchRunning") { DistractionWatchService.running }
  }
}
