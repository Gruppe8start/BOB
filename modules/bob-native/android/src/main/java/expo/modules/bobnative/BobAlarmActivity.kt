package expo.modules.bobnative

import android.app.Activity
import android.graphics.Color
import android.graphics.Typeface
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/** Full-screen alarm surface shown via the full-screen intent. Built in code to avoid resources. */
class BobAlarmActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val title = intent.getStringExtra(EXTRA_TITLE) ?: "Kip says: close it."
    val body = intent.getStringExtra(EXTRA_BODY) ?: ""

    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.rgb(13, 13, 13))
      setPadding(64, 64, 64, 64)
    }
    // The launcher icon is Kip (assets/icon.png), so reuse it instead of shipping a drawable.
    val size = (144 * resources.displayMetrics.density).toInt()
    root.addView(ImageView(this).apply {
      setImageDrawable(packageManager.getApplicationIcon(packageName))
      layoutParams = LinearLayout.LayoutParams(size, size)
    })
    root.addView(TextView(this).apply {
      text = title
      textSize = 28f
      setTypeface(typeface, Typeface.BOLD)
      setTextColor(Color.WHITE)
      gravity = Gravity.CENTER
      setPadding(0, 32, 0, 16)
    })
    root.addView(TextView(this).apply {
      text = body
      textSize = 16f
      setTextColor(Color.rgb(165, 197, 168))
      gravity = Gravity.CENTER
      setPadding(0, 0, 0, 48)
    })
    root.addView(Button(this).apply {
      text = "Back to studying"
      setOnClickListener {
        packageManager.getLaunchIntentForPackage(packageName)?.let { startActivity(it) }
        finish()
      }
    })
    setContentView(root)
  }

  companion object {
    const val EXTRA_TITLE = "title"
    const val EXTRA_BODY = "body"
  }
}
