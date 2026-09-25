import Foundation
import FamilyControls
#if canImport(AlarmKit)
import AlarmKit
import SwiftUI
#endif

// Copy of modules/bob-native/ios/BobShared.swift. This extension is a separate target and
// cannot link that pod, so keep the two files identical.

struct BobMonitorSettings: Codable {
  var reminderMode: String
  var countdownSeconds: Int
  var cooldownMinutes: Int
  var alarmEnabled: Bool
  var alarmTitle: String
  var alarmBody: String
}

struct BobSharedStore {
  static let activityName = "bob.daily"
  static let usageMilestones = [15, 30, 45, 60, 90, 120, 180, 240]

  let defaults: UserDefaults

  init?(group: String) {
    guard let defaults = UserDefaults(suiteName: group) else { return nil }
    self.defaults = defaults
  }

  var selection: FamilyActivitySelection? {
    get {
      guard let data = defaults.data(forKey: "bob.selection") else { return nil }
      return try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    }
    nonmutating set {
      defaults.set(try? JSONEncoder().encode(newValue), forKey: "bob.selection")
    }
  }

  var selectionCount: Int {
    guard let s = selection else { return 0 }
    return s.applicationTokens.count + s.categoryTokens.count + s.webDomainTokens.count
  }

  var settings: BobMonitorSettings? {
    get {
      guard let data = defaults.data(forKey: "bob.settings") else { return nil }
      return try? JSONDecoder().decode(BobMonitorSettings.self, from: data)
    }
    nonmutating set {
      defaults.set(try? JSONEncoder().encode(newValue), forKey: "bob.settings")
    }
  }

  static func today() -> String {
    let f = DateFormatter()
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: Date())
  }

  var usageMinutesToday: Int {
    defaults.string(forKey: "bob.usageDay") == Self.today() ? defaults.integer(forKey: "bob.usageMinutes") : 0
  }

  func recordUsage(minutes: Int) {
    let current = usageMinutesToday
    defaults.set(Self.today(), forKey: "bob.usageDay")
    defaults.set(max(current, minutes), forKey: "bob.usageMinutes")
  }

  var lastAlarmAt: Date? {
    get {
      let t = defaults.double(forKey: "bob.lastAlarmAt")
      return t > 0 ? Date(timeIntervalSince1970: t) : nil
    }
    nonmutating set { defaults.set(newValue?.timeIntervalSince1970 ?? 0, forKey: "bob.lastAlarmAt") }
  }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct BobAlarmMetadata: AlarmMetadata {}

@available(iOS 26.0, *)
enum BobAlarm {
  static func authorize() async -> Bool {
    switch AlarmManager.shared.authorizationState {
    case .authorized:
      return true
    case .notDetermined:
      return (try? await AlarmManager.shared.requestAuthorization()) == .authorized
    default:
      return false
    }
  }

  /// A real, Clock-app-grade alarm: bypasses Silent and Focus, full-screen on the Lock Screen.
  static func fire(in seconds: TimeInterval, title: String) async throws {
    let alert = AlarmPresentation.Alert(
      title: LocalizedStringResource(stringLiteral: title),
      stopButton: AlarmButton(text: "I closed it", textColor: .white, systemImageName: "checkmark")
    )
    let attributes = AlarmAttributes<BobAlarmMetadata>(
      presentation: AlarmPresentation(alert: alert),
      metadata: BobAlarmMetadata(),
      tintColor: .green
    )
    let configuration = AlarmManager.AlarmConfiguration<BobAlarmMetadata>.alarm(
      schedule: .fixed(Date().addingTimeInterval(max(1, seconds))),
      attributes: attributes,
      stopIntent: nil,
      secondaryIntent: nil,
      sound: .default
    )
    // The system caps concurrently scheduled alarms per app: Bob keeps at most one.
    for alarm in (try? AlarmManager.shared.alarms) ?? [] {
      try? AlarmManager.shared.cancel(id: alarm.id)
    }
    _ = try await AlarmManager.shared.schedule(id: UUID(), configuration: configuration)
  }
}
#endif
