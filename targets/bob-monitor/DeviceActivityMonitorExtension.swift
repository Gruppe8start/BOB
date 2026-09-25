import DeviceActivity
import Foundation
import UserNotifications

// Must match `ios.entitlements["com.apple.security.application-groups"]` in app.json
// and APP_GROUP in lib/config.ts.
private let appGroup = "group.com.maxschenck.bob"

/// Runs in its own process while the user is in *other* apps. Screen Time calls it when the
/// selected distracting apps cross a usage threshold registered by BobNativeModule.startMonitoring.
class DeviceActivityMonitorExtension: DeviceActivityMonitor {
  private let store = BobSharedStore(group: appGroup)

  override func eventDidReachThreshold(_ event: DeviceActivityEvent.Name, activity: DeviceActivityName) {
    super.eventDidReachThreshold(event, activity: activity)
    guard let store, let settings = store.settings else { return }
    let name = event.rawValue

    if name.hasPrefix("usage_"), let minutes = Int(name.dropFirst("usage_".count)) {
      store.recordUsage(minutes: minutes)
      notifyUsageMilestone(minutes: minutes, mode: settings.reminderMode, store: store)
    } else if name.hasPrefix("alarm_") {
      fireDistractionAlarm(settings: settings, store: store)
    }
  }

  private func fireDistractionAlarm(settings: BobMonitorSettings, store: BobSharedStore) {
    if let last = store.lastAlarmAt,
       Date().timeIntervalSince(last) < Double(settings.cooldownMinutes * 60) {
      return
    }
    store.lastAlarmAt = Date()

    #if canImport(AlarmKit)
    if #available(iOS 26.0, *) {
      final class Flag: @unchecked Sendable { var value = false }
      let scheduled = Flag()
      let semaphore = DispatchSemaphore(value: 0)
      let title = settings.alarmTitle
      Task {
        if await BobAlarm.authorize() {
          scheduled.value = (try? await BobAlarm.fire(in: 1, title: title)) != nil
        }
        semaphore.signal()
      }
      // The extension may be suspended as soon as this callback returns.
      _ = semaphore.wait(timeout: .now() + 5)
      if scheduled.value { return }
    }
    #endif

    // iOS < 26 or AlarmKit denied: the loudest thing left is a time-sensitive notification.
    post(title: settings.alarmTitle, body: settings.alarmBody.replacingOccurrences(of: "{app}", with: "that app"), timeSensitive: true)
  }

  private func notifyUsageMilestone(minutes: Int, mode: String, store: BobSharedStore) {
    let milestones: [Int]
    switch mode {
    case "Chill": milestones = [60]
    case "Brutal": milestones = [30, 60, 120]
    default: milestones = [45, 90]
    }
    guard milestones.contains(minutes) else { return }

    // Separate small cap for the extension; the app's own nudges have their own cap.
    let day = BobSharedStore.today()
    let countKey = "bob.monitorNotif.\(day)"
    let sent = store.defaults.integer(forKey: countKey)
    guard sent < 2 else { return }
    store.defaults.set(sent + 1, forKey: countKey)

    let body: String
    switch mode {
    case "Chill": body = "\(minutes) min in your distracting apps today. Maybe time for a study block?"
    case "Brutal": body = "\(minutes) minutes. Scrolling. I did the math on what that was worth."
    default: body = "\(minutes) min on distracting apps instead of studying. Just saying."
    }
    post(title: "Bob noticed.", body: body, timeSensitive: false)
  }

  private func post(title: String, body: String, timeSensitive: Bool) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    if timeSensitive { content.interruptionLevel = .timeSensitive }
    let request = UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil)
    UNUserNotificationCenter.current().add(request)
  }
}
