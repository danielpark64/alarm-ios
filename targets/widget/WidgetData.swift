import Foundation

// 앱이 넘겨 준 데이터(<App Group>/alarmapp/widget.json) — 만드는 쪽: src/utils/iosWidget.ts.
// 위젯은 계산하지 않고 이 표에서 날짜만 찾아 그린다.
struct WidgetStrings: Decodable {
  let nextAlarm: String
  let offToday: String
  let offIn: String
  let noOff: String
  let openApp: String
  let days: [String]
}

struct DayInfo {
  let name: String
  let colorHex: String
  let isOff: Bool
}

let appGroupId = "group.com.danielpark.shared"
let widgetCalendar = Calendar(identifier: .gregorian)

struct WidgetData: Decodable {
  let lang: String
  let f: String
  let l: [String]
  let c: [String]
  let o: [Int]
  let d: String
  let h: [Int]
  let a: [Double]
  let s: WidgetStrings

  static func load() -> WidgetData? {
    guard
      let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupId),
      let raw = try? Data(contentsOf: base.appendingPathComponent("alarmapp/widget.json"))
    else { return nil }
    return try? JSONDecoder().decode(WidgetData.self, from: raw)
  }

  private var firstDay: Date? {
    let p = f.split(separator: "-").compactMap { Int($0) }
    guard p.count == 3 else { return nil }
    return widgetCalendar.date(from: DateComponents(year: p[0], month: p[1], day: p[2]))
  }

  private func index(of date: Date) -> Int? {
    guard let first = firstDay else { return nil }
    let i = widgetCalendar.dateComponents([.day], from: first, to: widgetCalendar.startOfDay(for: date)).day ?? -1
    return i >= 0 && i < d.count ? i : nil
  }

  /// 표가 그 날짜까지 있는가 — 앱을 오래 안 열면 false가 되어 틀린 근무 대신 안내를 보여 준다
  func covers(_ date: Date) -> Bool { index(of: date) != nil }

  func day(_ date: Date) -> DayInfo? {
    guard let i = index(of: date) else { return nil }
    let ch = d[d.index(d.startIndex, offsetBy: i)]
    guard let k = "0123456789abcdefghijklmnopqrstuvwxyz".firstIndex(of: ch)
      .map({ "0123456789abcdefghijklmnopqrstuvwxyz".distance(from: "0123456789abcdefghijklmnopqrstuvwxyz".startIndex, to: $0) }),
      k < l.count, k < c.count, k < o.count
    else { return nil }
    return DayInfo(name: l[k], colorHex: c[k], isOff: o[k] == 1)
  }

  func isHoliday(_ date: Date) -> Bool {
    guard let i = index(of: date) else { return false }
    return h.contains(i)
  }

  func nextFire(after date: Date) -> Date? {
    let t = date.timeIntervalSince1970
    return a.first { $0 > t }.map { Date(timeIntervalSince1970: $0) }
  }

  func nextAlarmText(at date: Date) -> String {
    guard let next = nextFire(after: date) else { return "--:--" }
    let p = widgetCalendar.dateComponents([.hour, .minute], from: next)
    return String(format: "%02d:%02d", p.hour ?? 0, p.minute ?? 0)
  }

  /// "오늘 비번!" / "비번 N일 후" / "비번 없음"
  func offText(at date: Date) -> String {
    if day(date)?.isOff == true { return s.offToday }
    var n = 1
    while let next = widgetCalendar.date(byAdding: .day, value: n, to: date), covers(next) {
      if day(next)?.isOff == true { return s.offIn.replacingOccurrences(of: "{n}", with: String(n)) }
      n += 1
    }
    return s.noOff
  }

  /// 달력 위젯 ‹ ›로 갈 수 있는 달인가
  func hasMonth(_ month: Date) -> Bool { covers(month) }
}

// 달력 위젯에서 ‹ ›로 고른 달 — 잠깐 보고 나면 이번 달로 돌아온다(다음에 볼 때 지난달이 떠 있지 않게).
enum ViewedMonth {
  static let keepSeconds: TimeInterval = 300
  private static let monthKey = "alarmapp.widget.month"
  private static let atKey = "alarmapp.widget.monthAt"
  private static var store: UserDefaults? { UserDefaults(suiteName: appGroupId) }

  static func firstDay(of date: Date) -> Date {
    widgetCalendar.date(from: widgetCalendar.dateComponents([.year, .month], from: date)) ?? date
  }

  static func chosenAt() -> Date? {
    guard let t = store?.object(forKey: atKey) as? Double else { return nil }
    return Date(timeIntervalSince1970: t)
  }

  static func current(at date: Date) -> Date {
    guard
      let at = chosenAt(), date.timeIntervalSince(at) < keepSeconds, date >= at,
      let t = store?.object(forKey: monthKey) as? Double
    else { return firstDay(of: date) }
    return Date(timeIntervalSince1970: t)
  }

  static func set(_ month: Date, at date: Date) {
    store?.set(month.timeIntervalSince1970, forKey: monthKey)
    store?.set(date.timeIntervalSince1970, forKey: atKey)
  }
}
