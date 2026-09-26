package expo.modules.bobnative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import org.json.JSONObject

/**
 * Foreground service that polls UsageStatsManager for the foreground app.
 *
 * Alarm rules (feasibility doc, section 6):
 *  - A distracting app comes to the foreground -> a countdown starts.
 *  - The user leaves it before the countdown ends -> countdown is paused, no alarm.
 *  - The countdown ends while still in the app -> a full-screen-intent alarm fires and
 *    rings until the user leaves the app.
 *  - Cooldown: for N minutes after an alarm (or after leaving mid-countdown), re-opening a
 *    distracting app does not get a fresh countdown. After an alarm it rings immediately;
 *    after a paused countdown it resumes where it left off.
 */
class DistractionWatchService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private lateinit var config: Config

  private var foregroundPackage: String? = null
  private var lastQueryAt = 0L

  private var countdownEndsAt: Long? = null
  private var pausedRemainingMs: Long? = null
  private var pausedAt = 0L
  private var lastFiredAt = 0L
  private var ringtone: Ringtone? = null

  data class Config(
    val packages: Set<String>,
    val labels: Map<String, String>,
    val countdownMs: Long,
    val cooldownMs: Long,
    val alarmEnabled: Boolean,
    val alarmTitle: String,
    val alarmBody: String,
  )

  private val tick = object : Runnable {
    override fun run() {
      try {
        poll()
      } finally {
        handler.postDelayed(this, POLL_MS)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    config = loadConfig(this) ?: run {
      stopSelf()
      return START_NOT_STICKY
    }
    val notification = ongoingNotification()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(WATCH_NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(WATCH_NOTIFICATION_ID, notification)
    }
    running = true
    lastQueryAt = System.currentTimeMillis() - 60_000
    handler.removeCallbacks(tick)
    handler.post(tick)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(tick)
    stopRinging()
    running = false
    super.onDestroy()
  }

  private fun poll() {
    if (!UsageAccess.hasAccess(this)) return
    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
    val now = System.currentTimeMillis()
    val events = usm.queryEvents(lastQueryAt, now)
    val event = UsageEvents.Event()
    while (events.hasNextEvent()) {
      events.getNextEvent(event)
      when (event.eventType) {
        UsageAccess.RESUMED -> foregroundPackage = event.packageName
        UsageAccess.SCREEN_NON_INTERACTIVE, UsageAccess.KEYGUARD_SHOWN -> foregroundPackage = null
      }
    }
    lastQueryAt = now

    val inDistraction = foregroundPackage?.let { it in config.packages } == true
    if (inDistraction) onInDistraction(now) else onOutOfDistraction(now)
  }

  private fun onInDistraction(now: Long) {
    if (!config.alarmEnabled || ringtone != null) return
    val endsAt = countdownEndsAt
    when {
      endsAt != null -> if (now >= endsAt) fireAlarm(now)
      now - lastFiredAt < config.cooldownMs -> fireAlarm(now)
      pausedRemainingMs != null && now - pausedAt < config.cooldownMs ->
        countdownEndsAt = now + pausedRemainingMs!!
      else -> countdownEndsAt = now + config.countdownMs
    }
  }

  private fun onOutOfDistraction(now: Long) {
    countdownEndsAt?.let { endsAt ->
      pausedRemainingMs = (endsAt - now).coerceAtLeast(0)
      pausedAt = now
      countdownEndsAt = null
    }
    if (ringtone != null) {
      stopRinging()
      getSystemService(NotificationManager::class.java).cancel(ALARM_NOTIFICATION_ID)
    }
  }

  private fun fireAlarm(now: Long) {
    countdownEndsAt = null
    pausedRemainingMs = null
    lastFiredAt = now
    val appLabel = foregroundPackage?.let { config.labels[it] } ?: "that app"
    val body = config.alarmBody.replace("{app}", appLabel)

    val fullScreen = PendingIntent.getActivity(
      this, 0,
      Intent(this, BobAlarmActivity::class.java)
        .putExtra(BobAlarmActivity.EXTRA_TITLE, config.alarmTitle)
        .putExtra(BobAlarmActivity.EXTRA_BODY, body)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = Notification.Builder(this, ALARM_CHANNEL)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(config.alarmTitle)
      .setContentText(body)
      .setCategory(Notification.CATEGORY_ALARM)
      .setFullScreenIntent(fullScreen, true)
      .setOngoing(true)
      .build()
    getSystemService(NotificationManager::class.java).notify(ALARM_NOTIFICATION_ID, notification)
    startRinging()
  }

  private fun startRinging() {
    val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    ringtone = RingtoneManager.getRingtone(this, uri)?.apply {
      audioAttributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ALARM)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) isLooping = true
      play()
    }
    @Suppress("DEPRECATION")
    val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    vibrator.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 600, 400), 0))
  }

  private fun stopRinging() {
    ringtone?.stop()
    ringtone = null
    @Suppress("DEPRECATION")
    (getSystemService(Context.VIBRATOR_SERVICE) as Vibrator).cancel()
  }

  private fun createChannels() {
    val nm = getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(WATCH_CHANNEL, "Kip is watching", NotificationManager.IMPORTANCE_MIN)
    )
    nm.createNotificationChannel(
      NotificationChannel(ALARM_CHANNEL, "Distraction alarm", NotificationManager.IMPORTANCE_HIGH).apply {
        // The service plays the alarm sound itself so it can stop the moment the app is closed.
        setSound(null, null)
        enableVibration(false)
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      }
    )
  }

  private fun ongoingNotification(): Notification {
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 1, it, PendingIntent.FLAG_IMMUTABLE)
    }
    return Notification.Builder(this, WATCH_CHANNEL)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Kip is keeping an eye on your distracting apps")
      .setContentText("Countdown: ${config.countdownMs / 1000}s · Turn off in Kip")
      .setContentIntent(open)
      .setOngoing(true)
      .build()
  }

  companion object {
    private const val POLL_MS = 2_000L
    private const val PREFS = "bob_distraction_watch"
    private const val WATCH_CHANNEL = "bob-watch"
    private const val ALARM_CHANNEL = "bob-alarm"
    private const val WATCH_NOTIFICATION_ID = 4101
    private const val ALARM_NOTIFICATION_ID = 4102

    @Volatile
    var running = false
      private set

    fun saveConfig(context: Context, json: JSONObject) {
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
        .putString("config", json.toString())
        .apply()
    }

    private fun loadConfig(context: Context): Config? {
      val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("config", null)
        ?: return null
      val json = JSONObject(raw)
      val packages = json.getJSONArray("packages")
      val labels = json.getJSONObject("labels")
      return Config(
        packages = (0 until packages.length()).map { packages.getString(it) }.toSet(),
        labels = labels.keys().asSequence().associateWith { labels.getString(it) },
        countdownMs = json.getLong("countdownSeconds") * 1000,
        cooldownMs = json.getLong("cooldownMinutes") * 60_000,
        alarmEnabled = json.getBoolean("alarmEnabled"),
        alarmTitle = json.getString("alarmTitle"),
        alarmBody = json.getString("alarmBody"),
      )
    }
  }
}
