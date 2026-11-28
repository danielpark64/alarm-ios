import ExpoModulesCore
import Foundation
import AVFoundation
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
  // 알람마다 고른 소리(앱 번들 파일 이름, JS constants/alarmTones.ts). 비어 있으면(옛 JS) 기본 소리.
  @Field var sound: String = ""
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

    // 알람 소리 미리듣기 — 소리 고르기 시트에서 줄을 누르면 ms만큼만 재생(미디어 음량). 실제 알람과 무관.
    Function("previewSound") { (name: String, ms: Int) in
      DispatchQueue.main.async { Self.startPreview(name, ms) }
    }
    Function("stopPreview") { () in
      DispatchQueue.main.async { Self.endPreview() }
    }
    // 진단: 예약 실패 기록(최근 10건) — 개발 딥링크 report=1이 dev_report에 담는다(11-28 요일 반복 예약 누락 조사).
    Function("failures") { () -> [String] in Self.failures }

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

  static var failures: [String] = []
  static func noteFailure(_ m: String) { failures.append(m); if failures.count > 10 { failures.removeFirst() } }
  private static var previewPlayer: AVAudioPlayer?
  private static var previewStop: DispatchWorkItem?

  static func startPreview(_ name: String, _ ms: Int) {
    endPreview()
    let base = (name as NSString).deletingPathExtension
    let ext = (name as NSString).pathExtension
    guard let url = Bundle.main.url(forResource: base, withExtension: ext.isEmpty ? nil : ext) else { return }
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, options: [.duckOthers])
      try AVAudioSession.sharedInstance().setActive(true)
      let p = try AVAudioPlayer(contentsOf: url)
      p.play()
      previewPlayer = p
      let w = DispatchWorkItem { endPreview() }
      previewStop = w
      DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(max(0, ms)), execute: w)
    } catch {
      NSLog("[AlarmTone] 미리듣기 실패 %@", String(describing: error))
    }
  }

  static func endPreview() {
    previewStop?.cancel(); previewStop = nil
    guard let p = previewPlayer else { return }
    p.stop(); previewPlayer = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
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
    guard AlarmManager.shared.authorizationState == .authorized, let uuid = UUID(uuidString: o.id) else { noteFailure("\(o.alarmId) 권한/UUID"); return false }

    let sched: Alarm.Schedule
    if o.weekdays.isEmpty {
      sched = .fixed(Date(timeIntervalSince1970: o.fireMs / 1000))
    } else {
      // 이름 표로 바꾼다 — rawValue(init)는 "monday"를 못 읽어 nil이 됐고, 요일 반복 알람이 조용히 예약되지 않았다(11-28 폰).
      let names: [String: Locale.Weekday] = ["monday": .monday, "tuesday": .tuesday, "wednesday": .wednesday, "thursday": .thursday,
                                             "friday": .friday, "saturday": .saturday, "sunday": .sunday]
      let days = o.weekdays.compactMap { names[$0] }
      guard !days.isEmpty else { noteFailure("\(o.alarmId) 요일 비어 있음 \(o.weekdays)"); return false }
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
    // 소리: 알람마다 고른 앱 번들 파일(expo-notifications 플러그인이 넣는다, JS가 o.sound로 넘김). 개발 테스트만 무음 파일.
    // o.sound가 비면(옛 JS) 기본 소리 — 파일 이름은 JS constants/alarmTones.ts 한 곳에서만 정한다.
    let fallback = "alarm_long.wav" // tone-fallback: 옛 JS가 sound를 안 보낼 때만
    let sound: AlertConfiguration.AlertSound = .named(o.silent ? "silent_short.wav" : (o.sound.isEmpty ? fallback : o.sound))
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
      noteFailure("\(o.alarmId) \(o.weekdays.isEmpty ? "fixed" : "weekly") \(o.sound): \(String(describing: error))")
      return false
    }
  }
  #endif
}
