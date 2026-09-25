package expo.modules.bobnative

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import java.util.Calendar

object UsageAccess {
  // UsageEvents.Event constants; the named ones were deprecated/renamed across API levels.
  const val RESUMED = 1
  const val PAUSED = 2
  const val STOPPED = 23
  const val SCREEN_NON_INTERACTIVE = 16
  const val KEYGUARD_SHOWN = 17

  fun hasAccess(context: Context): Boolean {
    val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
    val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    } else {
      @Suppress("DEPRECATION")
      appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), context.packageName)
    }
    return mode == AppOpsManager.MODE_ALLOWED
  }

  private fun startOfToday(): Long = Calendar.getInstance().apply {
    set(Calendar.HOUR_OF_DAY, 0)
    set(Calendar.MINUTE, 0)
    set(Calendar.SECOND, 0)
    set(Calendar.MILLISECOND, 0)
  }.timeInMillis

  /**
   * Foreground minutes per package since local midnight, computed from raw events
   * (the aggregated daily buckets can bleed in usage from yesterday).
   */
  fun todayMinutes(context: Context, packages: List<String>): Map<String, Double> {
    val wanted = packages.toSet()
    val result = packages.associateWith { 0L }.toMutableMap()
    if (!hasAccess(context)) return result.mapValues { 0.0 }

    val usm = context.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val events = usm.queryEvents(startOfToday(), now)
    val event = UsageEvents.Event()
    val resumedAt = mutableMapOf<String, Long>()

    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      val pkg = event.packageName
      when (event.eventType) {
        RESUMED -> if (pkg in wanted) resumedAt[pkg] = event.timeStamp
        PAUSED, STOPPED -> resumedAt.remove(pkg)?.let { start ->
          result[pkg] = (result[pkg] ?: 0L) + (event.timeStamp - start)
        }
        SCREEN_NON_INTERACTIVE -> {
          for ((p, start) in resumedAt) result[p] = (result[p] ?: 0L) + (event.timeStamp - start)
          resumedAt.clear()
        }
      }
    }
    for ((p, start) in resumedAt) result[p] = (result[p] ?: 0L) + (now - start)
    return result.mapValues { it.value / 60_000.0 }
  }

  /** Matches user-typed names ("Duolingo") against launcher labels, case-insensitively. */
  fun resolveByLabel(context: Context, labels: List<String>): Map<String, String> {
    val pm = context.packageManager
    val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    val apps = pm.queryIntentActivities(launcher, 0)
    val found = mutableMapOf<String, String>()
    for (label in labels) {
      val needle = label.trim().lowercase()
      if (needle.isEmpty()) continue
      val match = apps.firstOrNull { it.loadLabel(pm).toString().lowercase() == needle }
        ?: apps.firstOrNull { it.loadLabel(pm).toString().lowercase().contains(needle) }
      if (match != null) found[label] = match.activityInfo.packageName
    }
    return found
  }
}
