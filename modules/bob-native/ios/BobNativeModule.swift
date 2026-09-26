import DeviceActivity
import ExpoModulesCore
import FamilyControls
import SwiftUI

struct MonitorConfig: Record {
  @Field var appGroup: String = ""
  @Field var reminderMode: String = "Firm"
  @Field var countdownSeconds: Int = 180
  @Field var cooldownMinutes: Int = 10
  @Field var alarmEnabled: Bool = true
  @Field var alarmTitle: String = "Close it."
  @Field var alarmBody: String = "Kip said close it."
}

private func statusString(_ status: AuthorizationStatus) -> String {
  switch status {
  case .approved: return "approved"
  case .denied: return "denied"
  default: return "notDetermined"
  }
}

private struct PickerSheet: View {
  @State private var selection: FamilyActivitySelection
  let onDone: (FamilyActivitySelection?) -> Void

  init(initial: FamilyActivitySelection, onDone: @escaping (FamilyActivitySelection?) -> Void) {
    _selection = State(initialValue: initial)
    self.onDone = onDone
  }

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $selection)
        .navigationTitle("Distracting apps")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("Cancel") { onDone(nil) } }
          ToolbarItem(placement: .confirmationAction) { Button("Done") { onDone(selection) } }
        }
    }
  }
}

public class BobNativeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BobNative")

    Function("getAlarmSupport") { () -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return "alarmkit" }
      #endif
      return "notification-only"
    }

    // MARK: Screen Time

    Function("getScreenTimeStatus") { () -> String in
      statusString(AuthorizationCenter.shared.authorizationStatus)
    }

    AsyncFunction("requestScreenTimeAuthorization") { () async -> String in
      try? await AuthorizationCenter.shared.requestAuthorization(for: .individual)
      return statusString(AuthorizationCenter.shared.authorizationStatus)
    }

    // iOS never reveals which apps were picked, only opaque tokens; we store those in the
    // app group so the monitor extension can use them.
    AsyncFunction("pickDistractingApps") { (appGroup: String, promise: Promise) in
      guard let store = BobSharedStore(group: appGroup),
            let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject("E_PICKER", "Cannot present the Screen Time app picker right now.")
        return
      }
      let sheet = PickerSheet(initial: store.selection ?? FamilyActivitySelection()) { picked in
        if let picked { store.selection = picked }
        presenter.dismiss(animated: true)
        promise.resolve(store.selectionCount)
      }
      let host = UIHostingController(rootView: sheet)
      host.isModalInPresentation = true
      presenter.present(host, animated: true)
    }.runOnQueue(.main)

    Function("getSelectedAppCount") { (appGroup: String) -> Int in
      BobSharedStore(group: appGroup)?.selectionCount ?? 0
    }

    Function("getUsageMinutesToday") { (appGroup: String) -> Int in
      BobSharedStore(group: appGroup)?.usageMinutesToday ?? 0
    }

    AsyncFunction("startMonitoring") { (config: MonitorConfig) in
      guard let store = BobSharedStore(group: config.appGroup),
            let selection = store.selection, store.selectionCount > 0 else {
        throw Exception(name: "E_NO_SELECTION", description: "Pick your distracting apps first.")
      }
      store.settings = BobMonitorSettings(
        reminderMode: config.reminderMode,
        countdownSeconds: config.countdownSeconds,
        cooldownMinutes: config.cooldownMinutes,
        alarmEnabled: config.alarmEnabled,
        alarmTitle: config.alarmTitle,
        alarmBody: config.alarmBody
      )

      func event(seconds: Int) -> DeviceActivityEvent {
        DeviceActivityEvent(
          applications: selection.applicationTokens,
          categories: selection.categoryTokens,
          webDomains: selection.webDomainTokens,
          threshold: DateComponents(minute: seconds / 60, second: seconds % 60)
        )
      }

      var events: [DeviceActivityEvent.Name: DeviceActivityEvent] = [:]
      for minutes in BobSharedStore.usageMilestones {
        events[DeviceActivityEvent.Name("usage_\(minutes)")] = event(seconds: minutes * 60)
      }
      // iOS cannot tell us when a distracting app is closed, so the "countdown" is measured
      // in cumulative usage: every `countdownSeconds` of use today triggers the alarm.
      if config.alarmEnabled {
        let step = max(60, config.countdownSeconds)
        var k = 1
        while k <= 12 && step * k <= 4 * 3600 {
          events[DeviceActivityEvent.Name("alarm_\(k)")] = event(seconds: step * k)
          k += 1
        }
      }

      let center = DeviceActivityCenter()
      let name = DeviceActivityName(BobSharedStore.activityName)
      center.stopMonitoring([name])
      try center.startMonitoring(
        name,
        during: DeviceActivitySchedule(
          intervalStart: DateComponents(hour: 0, minute: 0),
          intervalEnd: DateComponents(hour: 23, minute: 59),
          repeats: true
        ),
        events: events
      )
    }

    Function("stopMonitoring") {
      DeviceActivityCenter().stopMonitoring([DeviceActivityName(BobSharedStore.activityName)])
    }

    // MARK: AlarmKit (iOS 26+)

    AsyncFunction("requestAlarmAuthorization") { () async -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return await BobAlarm.authorize() }
      #endif
      return false
    }

    AsyncFunction("scheduleTestAlarm") { (seconds: Double, title: String) async throws -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        guard await BobAlarm.authorize() else { return false }
        try await BobAlarm.fire(in: seconds, title: title)
        return true
      }
      #endif
      return false
    }

    // Android-only functions; defined so JS can call them without platform checks.
    Function("hasUsageAccess") { false }
    Function("isDistractionWatchRunning") { false }
    Function("canUseFullScreenIntent") { false }
  }
}
