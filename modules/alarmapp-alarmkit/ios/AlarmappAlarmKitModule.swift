import ExpoModulesCore
import Foundation
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
import ActivityKit
#endif

// iOS 26+ AlarmKit 예약 — 무음·집중 모드를 뚫고 시계 앱처럼 전체 화면으로 울린다.
// 경로 결정은 JS(src/utils/alarmkitRoute.ts), 호출은 src/utils/notifications/alarmkit.ts(직렬 큐).
// 원장: UserDefaults "alarmkit_ledger_v1" = [예약 UUID: 알람 id] — 알람 하나만 지울 때(cancelForAlarm) 쓴다.
// ⚠️ 메타데이터 타입 이름은 위젯 확장(targets/widget/AlarmLiveActivity.swift)과 반드시 같아야 한다.

struct ScheduleOptions: Record {
  @Field var id: String = ""
  @Field var alarmId: Int = -1
  @Field var fireMs: Double = 0
  @Field var hour: Int = 0
  @Field var minute: Int = 0
  @Field var weekdays: [String] = []
  @Field var title: String = ""
  @Field var stopText: String = ""
  @Field var snoozeText: String = ""
  @Field var snoozeMin: Int = 0
  @Field var silent: Bool = false
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct AlarmappAlarmMetadata: AlarmMetadata {}
#endif

private let ledgerKey = "alarmkit_ledger_v1"
private func loadLedger() -> [String: Int] {
  UserDefaults.standard.dictionary(forKey: ledgerKey) as? [String: Int] ?? [:]
}
private func saveLedger(_ l: [String: Int]) { UserDefaults.standard.set(l, forKey: ledgerKey) }

public class AlarmappAlarmKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AlarmappAlarmKit")

    Function("isAvailable") { () -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return true }
      #endif
      return false
    }

    Function("authorizationState") { () -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return Self.authString(AlarmManager.shared.authorizationState) }
      #endif
      return "unavailable"
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let s = (try? await AlarmManager.shared.requestAuthorization()) ?? AlarmManager.shared.authorizationState
        return Self.authString(s)
      }
      #endif
      return "unavailable"
    }

    AsyncFunction("schedule") { (o: ScheduleOptions) async -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return await Self.schedule(o) }
      #endif
      return false
    }

    AsyncFunction("cancelForAlarm") { (alarmId: Int) -> Int in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        var ledger = loadLedger()
        let ids = ledger.filter { $0.value == alarmId }.map { $0.key }
        for k in ids {
          if let u = UUID(uuidString: k) { try? AlarmManager.shared.cancel(id: u) }
          ledger.removeValue(forKey: k)
        }
        saveLedger(ledger)
        return ids.count
      }
      #endif
      return 0
    }

    // 원장 + AlarmKit이 알고 있는 이 앱의 예약 전부를 지운다. 단 지금 울리는 중·다시 울림 대기 중이면서
    // keepActiveIds(켜져 있는 알람)에 속한 것은 남긴다 — 울리는 도중 앱을 열어도 울림이 끊기지 않게.
    AsyncFunction("cancelAll") { (keepActiveIds: [Int]) -> Int in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let keep = Set(keepActiveIds)
        let ledger = loadLedger()
        var kept: [String: Int] = [:]
        var n = 0
        let live = (try? AlarmManager.shared.alarms) ?? []
        var seen = Set<String>()
        for a in live {
          let k = a.id.uuidString
          seen.insert(k)
          if a.state != .scheduled, let aid = ledger[k], keep.contains(aid) { kept[k] = aid; continue }
          try? AlarmManager.shared.cancel(id: a.id); n += 1
        }
        for k in ledger.keys where !seen.contains(k) {
          if let u = UUID(uuidString: k) { try? AlarmManager.shared.cancel(id: u) }
        }
        saveLedger(kept)
        return n
      }
      #endif
      return 0
    }

    AsyncFunction("listScheduled") { () -> [[String: Any]] in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        let ledger = loadLedger()
        let live = (try? AlarmManager.shared.alarms) ?? []
        return live.map { a in
          var when: Any = NSNull()
          if case .fixed(let d)? = a.schedule { when = d.timeIntervalSince1970 * 1000 }
          if case .relative(let r)? = a.schedule { when = String(format: "weekly %02d:%02d", r.time.hour, r.time.minute) }
          return ["id": a.id.uuidString, "alarmId": ledger[a.id.uuidString] ?? -1, "state": "\(a.state)", "when": when]
        }
      }
      #endif
      return []
    }
  }

  #if canImport(AlarmKit)
  @available(iOS 26.0, *)
  static func authString(_ s: AlarmManager.AuthorizationState) -> String {
    switch s {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "denied"
    }
  }

  private static func text(_ s: String) -> LocalizedStringResource {
    LocalizedStringResource(String.LocalizationValue(s))
  }

  @available(iOS 26.0, *)
  static func schedule(_ o: ScheduleOptions) async -> Bool {
    guard AlarmManager.shared.authorizationState == .authorized, let uuid = UUID(uuidString: o.id) else { return false }

    let sched: Alarm.Schedule
    if o.weekdays.isEmpty {
      sched = .fixed(Date(timeIntervalSince1970: o.fireMs / 1000))
    } else {
      let days = o.weekdays.compactMap { Locale.Weekday(rawValue: $0) }
      guard !days.isEmpty else { return false }
      sched = .relative(.init(time: .init(hour: o.hour, minute: o.minute), repeats: .weekly(days)))
    }

    // [다시 울림] = 스누즈 분이 있을 때만. 누르면 시스템이 그 분만큼 카운트다운 뒤 다시 울린다(.countdown).
    let accent = Color(red: 0x6c / 255.0, green: 0x5c / 255.0, blue: 0xe7 / 255.0)
    let snooze: AlarmButton? = o.snoozeMin > 0
      ? AlarmButton(text: text(o.snoozeText), textColor: .white, systemImageName: "repeat") : nil
    let behavior: AlarmPresentation.Alert.SecondaryButtonBehavior? = snooze != nil ? .countdown : nil
    let alert: AlarmPresentation.Alert
    if #available(iOS 26.1, *) {
      alert = .init(title: text(o.title), secondaryButton: snooze, secondaryButtonBehavior: behavior)
    } else {
      // iOS 26.0은 끄기 버튼을 직접 줘야 한다(26.1부터 시스템이 그린다)
      let stop = AlarmButton(text: text(o.stopText), textColor: .white, systemImageName: "stop.circle")
      alert = .init(title: text(o.title), stopButton: stop, secondaryButton: snooze, secondaryButtonBehavior: behavior)
    }
    let presentation = snooze != nil
      ? AlarmPresentation(alert: alert, countdown: .init(title: text(o.title)))
      : AlarmPresentation(alert: alert)
    let attributes = AlarmAttributes<AlarmappAlarmMetadata>(presentation: presentation, metadata: AlarmappAlarmMetadata(), tintColor: accent)
    let countdown = snooze != nil ? Alarm.CountdownDuration(preAlert: nil, postAlert: TimeInterval(o.snoozeMin * 60)) : nil
    // 소리: 앱 번들의 alarm_long.wav(expo-notifications 플러그인이 넣는다). 개발 테스트만 무음 파일.
    let sound: AlertConfiguration.AlertSound = .named(o.silent ? "silent_short.wav" : "alarm_long.wav")
    let config = AlarmManager.AlarmConfiguration<AlarmappAlarmMetadata>(
      countdownDuration: countdown, schedule: sched, attributes: attributes, sound: sound)

    // 같은 UUID가 이미 있으면 덮어쓴다(겹쳐 돈 재예약이 같은 슬롯을 두 번 걸지 않게)
    try? AlarmManager.shared.cancel(id: uuid)
    do {
      _ = try await AlarmManager.shared.schedule(id: uuid, configuration: config)
      var ledger = loadLedger(); ledger[o.id] = o.alarmId; saveLedger(ledger)
      return true
    } catch {
      NSLog("[AlarmKit] 예약 실패 %@: %@", o.id, String(describing: error))
      return false
    }
  }
  #endif
}
