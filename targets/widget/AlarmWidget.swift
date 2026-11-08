import SwiftUI
import WidgetKit

// iOS 위젯 — 작게·중간(이번 주)·크게(한 달 달력)·잠금화면. 앱이 넘겨 준 표만 그린다(WidgetData.swift).
private let widgetOpenURL = URL(string: "alarmapp://?widget=1")
private let offColor = Color(hex: "#3B82F6") // 달력의 비번 파란 테두리와 같은 계열
private let sundayColor = Color(hex: "#E5484D")
// 앱 달력의 오늘 표시와 같은 보라 — Color.accentColor는 위젯에서 시스템 파랑이 되어 비번과 겹친다
private let todayColor = Color(hex: "#6C5CE7")

struct AlarmEntry: TimelineEntry {
  let date: Date
  let data: WidgetData?
  let month: Date
}

struct AlarmProvider: TimelineProvider {
  private static let maxEntries = 60
  private static let aheadDays = 14

  private func entry(_ date: Date, _ data: WidgetData?) -> AlarmEntry {
    AlarmEntry(date: date, data: data, month: ViewedMonth.current(at: date))
  }

  func placeholder(in context: Context) -> AlarmEntry { entry(Date(), nil) }

  func getSnapshot(in context: Context, completion: @escaping (AlarmEntry) -> Void) {
    completion(entry(Date(), WidgetData.load()))
  }

  // iOS는 위젯 코드를 수시로 돌려 주지 않으므로 바뀌는 시점(자정·알람 시각·고른 달 되돌림)을 미리 줄 세워 넘긴다
  func getTimeline(in context: Context, completion: @escaping (Timeline<AlarmEntry>) -> Void) {
    let now = Date()
    guard let data = WidgetData.load() else {
      completion(Timeline(entries: [entry(now, nil)], policy: .never))
      return
    }
    let limit = widgetCalendar.date(byAdding: .day, value: Self.aheadDays, to: now) ?? now
    var points = Set<Date>([now])
    let today = widgetCalendar.startOfDay(for: now)
    for i in 1...Self.aheadDays {
      if let midnight = widgetCalendar.date(byAdding: .day, value: i, to: today) { points.insert(midnight) }
    }
    data.a.map { Date(timeIntervalSince1970: $0) }.filter { $0 > now && $0 <= limit }.forEach { points.insert($0) }
    if let at = ViewedMonth.chosenAt() {
      let back = at.addingTimeInterval(ViewedMonth.keepSeconds)
      if back > now { points.insert(back) }
    }
    let entries = points.sorted().prefix(Self.maxEntries).map { entry($0, data) }
    completion(Timeline(entries: entries, policy: .atEnd))
  }
}

extension Color {
  init(hex: String) {
    let v = UInt64(hex.dropFirst(), radix: 16) ?? 0
    self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
  }
}

private func dayColor(_ info: DayInfo) -> Color { info.isOff ? offColor : Color(hex: info.colorHex) }

// 칸 안의 근무 이름 — 칸이 좁으니 긴 외국어는 줄어들고, 그래도 넘치면 잘린다
// 칸 안의 근무 이름 — 칸이 좁으니 긴 외국어는 줄어들고, 그래도 넘치면 잘린다
private struct ShiftPill: View {
  let info: DayInfo
  let size: CGFloat

  var body: some View {
    Text(info.name)
      .font(.system(size: size, weight: .bold))
      .lineLimit(1)
      .minimumScaleFactor(0.5)
      .foregroundColor(dayColor(info))
      .padding(.horizontal, 1)
      .padding(.vertical, 1)
      .frame(maxWidth: .infinity)
      .background(RoundedRectangle(cornerRadius: 4).fill(dayColor(info).opacity(0.18)))
  }
}

// 오늘 날짜 — 색을 채운 둥근 바탕에 흰 글씨(앱 달력의 오늘 표시와 같은 모양)
private struct DayNumber: View {
  let day: Date
  let isToday: Bool
  let red: Bool
  let size: CGFloat

  var body: some View {
    Text("\(widgetCalendar.component(.day, from: day))")
      .font(.system(size: size, weight: isToday ? .heavy : .medium))
      .foregroundColor(isToday ? .white : (red ? sundayColor : .secondary))
      .padding(.horizontal, isToday ? 5 : 0)
      .background(Capsule().fill(isToday ? todayColor : Color.clear))
  }
}

// 오늘 칸 바탕 — 옅은 색 + 진한 테두리
private struct TodayBox: View {
  let isToday: Bool
  var body: some View {
    RoundedRectangle(cornerRadius: 6)
      .fill(isToday ? todayColor.opacity(0.3) : Color.clear)
      .overlay(RoundedRectangle(cornerRadius: 6).stroke(isToday ? todayColor : Color.clear, lineWidth: 2.5))
  }
}

// 알람은 보조 정보 — 작은 한 줄
private struct SmallAlarm: View {
  let data: WidgetData
  let date: Date
  var body: some View {
    HStack(spacing: 3) {
      Image(systemName: "alarm.fill")
      Text(data.nextAlarmText(at: date))
    }
    .font(.caption.weight(.semibold))
    .foregroundColor(.secondary)
    .lineLimit(1)
  }
}

private func todayLabel(_ data: WidgetData, _ date: Date) -> String {
  let f = DateFormatter()
  f.locale = Locale(identifier: data.lang)
  f.setLocalizedDateFormatFromTemplate("MMMdEEE")
  return f.string(from: date)
}

// 오늘 근무를 크게 — 위젯의 주인공
private struct TodayShift: View {
  let data: WidgetData
  let date: Date
  let size: CGFloat

  var body: some View {
    if let info = data.day(date) {
      Text(info.name)
        .font(.system(size: size, weight: .heavy, design: .rounded))
        .foregroundColor(dayColor(info))
        .lineLimit(1)
        .minimumScaleFactor(0.4)
    }
  }
}

private struct OpenAppView: View {
  let text: String
  var body: some View {
    Text(text).font(.footnote).foregroundColor(.secondary).multilineTextAlignment(.center)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

private struct SmallView: View {
  let data: WidgetData
  let date: Date

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      SmallAlarm(data: data, date: date)
      Spacer(minLength: 0)
      Text(todayLabel(data, date)).font(.caption.weight(.semibold)).foregroundColor(.secondary).lineLimit(1).minimumScaleFactor(0.7)
      TodayShift(data: data, date: date, size: 46)
      Text(data.offText(at: date)).font(.caption2).foregroundColor(.secondary).lineLimit(1).minimumScaleFactor(0.7)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

private struct WeekStrip: View {
  let data: WidgetData
  let date: Date

  private var days: [Date] {
    let start = widgetCalendar.date(byAdding: .day, value: 1 - widgetCalendar.component(.weekday, from: date), to: widgetCalendar.startOfDay(for: date)) ?? date
    return (0..<7).compactMap { widgetCalendar.date(byAdding: .day, value: $0, to: start) }
  }

  var body: some View {
    HStack(spacing: 4) {
      ForEach(Array(days.enumerated()), id: \.offset) { i, d in
        let today = widgetCalendar.isDate(d, inSameDayAs: date)
        let red = i == 0 || data.isHoliday(d)
        VStack(spacing: 3) {
          HStack(spacing: 2) {
            Text(i < data.s.days.count ? data.s.days[i] : "").font(.system(size: 11, weight: .semibold)).lineLimit(1).minimumScaleFactor(0.6)
              .foregroundColor(red && !today ? sundayColor : .secondary)
            DayNumber(day: d, isToday: today, red: red, size: 12)
          }
          // 근무 이름이 주인공 — 남는 높이를 전부 쓴다
          if let info = data.day(d) {
            Text(info.name)
              .font(.system(size: 26, weight: .heavy, design: .rounded))
              .lineLimit(1)
              .minimumScaleFactor(0.4)
              .foregroundColor(dayColor(info))
              .padding(.horizontal, 1)
              .frame(maxWidth: .infinity, maxHeight: .infinity)
              .background(RoundedRectangle(cornerRadius: 6).fill(dayColor(info).opacity(0.18)))
          } else {
            Spacer(minLength: 0)
          }
        }
        .padding(4)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(TodayBox(isToday: today))
      }
    }
  }
}

// 중간 — 이번 주 근무표가 전부. 날짜·알람은 맨 위 작은 한 줄
private struct MediumView: View {
  let data: WidgetData
  let date: Date

  var body: some View {
    VStack(spacing: 6) {
      HStack {
        Text(todayLabel(data, date)).font(.caption.weight(.semibold)).foregroundColor(.secondary).lineLimit(1)
        Spacer(minLength: 6)
        SmallAlarm(data: data, date: date)
      }
      WeekStrip(data: data, date: date)
    }
  }
}

private struct MonthButton: View {
  let symbol: String
  let delta: Int
  let enabled: Bool

  var body: some View {
    if #available(iOS 17.0, *) {
      Button(intent: MonthIntent(delta: delta)) {
        Image(systemName: symbol).font(.system(size: 13, weight: .semibold)).frame(width: 30, height: 24)
      }
      .buttonStyle(.plain)
      // disabled를 쓰면 누른 것이 위젯 전체로 넘어가 앱이 열린다 — 끝에서는 색만 흐리게 하고 MonthIntent가 그대로 둔다
      .foregroundColor(enabled ? todayColor : .secondary.opacity(0.35))
    }
  }
}

private struct LargeView: View {
  let data: WidgetData
  let date: Date
  let month: Date

  private var title: String {
    let f = DateFormatter()
    f.locale = Locale(identifier: data.lang)
    f.setLocalizedDateFormatFromTemplate("yMMMM")
    return f.string(from: month)
  }

  // 달력에 그릴 칸 — 앞은 지난달 자리(nil)로 채워 일요일부터 맞춘다
  private var cells: [Date?] {
    let lead = widgetCalendar.component(.weekday, from: month) - 1
    let count = widgetCalendar.range(of: .day, in: .month, for: month)?.count ?? 30
    let days: [Date?] = (0..<count).map { widgetCalendar.date(byAdding: .day, value: $0, to: month) }
    return Array(repeating: nil, count: lead) + days
  }

  private func canMove(_ delta: Int) -> Bool {
    guard let next = widgetCalendar.date(byAdding: .month, value: delta, to: month) else { return false }
    return data.hasMonth(next)
  }

  var body: some View {
    let all = cells
    let rows = stride(from: 0, to: all.count, by: 7).map { Array(all[$0..<min($0 + 7, all.count)]) }
    VStack(spacing: 3) {
      HStack(spacing: 0) {
        Text(title).font(.subheadline.weight(.bold)).lineLimit(1).minimumScaleFactor(0.7)
        MonthButton(symbol: "chevron.left", delta: -1, enabled: canMove(-1))
        MonthButton(symbol: "chevron.right", delta: 1, enabled: canMove(1))
        Spacer(minLength: 4)
        SmallAlarm(data: data, date: date)
      }
      HStack(spacing: 2) {
        ForEach(0..<7, id: \.self) { i in
          Text(i < data.s.days.count ? data.s.days[i] : "").font(.system(size: 10)).lineLimit(1).minimumScaleFactor(0.6)
            .foregroundColor(i == 0 ? sundayColor : .secondary).frame(maxWidth: .infinity)
        }
      }
      ForEach(Array(rows.enumerated()), id: \.offset) { _, row in
        HStack(spacing: 2) {
          ForEach(0..<7, id: \.self) { i in
            MonthCell(data: data, today: date, day: i < row.count ? row[i] : nil, isSunday: i == 0)
          }
        }
        .frame(maxHeight: .infinity)
      }
    }
  }
}

private struct MonthCell: View {
  let data: WidgetData
  let today: Date
  let day: Date?
  let isSunday: Bool

  var body: some View {
    let isToday = day.map { widgetCalendar.isDate($0, inSameDayAs: today) } ?? false
    VStack(spacing: 2) {
      if let d = day {
        DayNumber(day: d, isToday: isToday, red: isSunday || data.isHoliday(d), size: 10)
        if let info = data.day(d) { ShiftPill(info: info, size: 14) }
        Spacer(minLength: 0)
      }
    }
    .padding(.top, 2)
    .padding(.horizontal, 1)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(TodayBox(isToday: isToday))
  }
}

private struct LockView: View {
  let data: WidgetData
  let date: Date

  var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      if let info = data.day(date) {
        Text(info.name).font(.system(size: 22, weight: .heavy, design: .rounded)).lineLimit(1).minimumScaleFactor(0.6)
      }
      HStack(spacing: 3) {
        Image(systemName: "alarm.fill")
        Text(data.nextAlarmText(at: date))
        // 쉬는 날은 "비번" 아래에 "오늘 비번!"이 겹치므로 생략
        if data.day(date)?.isOff != true {
          Text("· " + data.offText(at: date)).lineLimit(1).minimumScaleFactor(0.7)
        }
      }
      .font(.caption2)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct AlarmWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: AlarmEntry

  @ViewBuilder
  private var content: some View {
    if let data = entry.data, data.covers(entry.date) {
      switch family {
      case .accessoryRectangular: LockView(data: data, date: entry.date)
      case .systemMedium: MediumView(data: data, date: entry.date)
      case .systemLarge: LargeView(data: data, date: entry.date, month: entry.month)
      default: SmallView(data: data, date: entry.date)
      }
    } else {
      OpenAppView(text: entry.data?.s.openApp ?? "")
    }
  }

  var body: some View {
    content.widgetBackground(lockScreen: family == .accessoryRectangular).widgetURL(widgetOpenURL)
  }
}

extension View {
  // iOS 17부터는 containerBackground가 없으면 위젯이 경고 화면으로 그려지고 여백도 시스템이 준다. 16에는 이 API가 없다.
  @ViewBuilder
  func widgetBackground(lockScreen: Bool) -> some View {
    if #available(iOS 17.0, *) {
      containerBackground(for: .widget) { lockScreen ? Color.clear : Color("$widgetBackground") }
    } else if lockScreen {
      self
    } else {
      padding().background(Color("$widgetBackground"))
    }
  }
}

// 위젯 목록에 보일 이름 — 위젯 목록은 앱 안 언어 설정이 아니라 기기 언어를 따른다
private func galleryText() -> (name: String, description: String) {
  let table: [(String, String, String)] = [
    ("ko", "교대알람", "다음 알람과 근무표를 봅니다."),
    ("ja", "RotaWake", "次のアラームと勤務表を表示します。"),
    ("zh-Hans", "RotaWake", "查看下一个闹钟和排班表。"),
    ("zh-Hant", "RotaWake", "查看下一個鬧鐘和班表。"),
    ("es", "RotaWake", "Consulta tu próxima alarma y tus turnos."),
    ("fr", "RotaWake", "Consultez votre prochaine alarme et vos postes."),
    ("de", "RotaWake", "Nächster Wecker und Dienstplan auf einen Blick."),
    ("pt", "RotaWake", "Veja o próximo alarme e seus turnos."),
  ]
  let preferred = Locale.preferredLanguages.first ?? "en"
  let hit = table.first { preferred.hasPrefix($0.0) }
  return (hit?.1 ?? "RotaWake", hit?.2 ?? "See your next alarm and shifts.")
}

struct AlarmWidget: Widget {
  var body: some WidgetConfiguration {
    let text = galleryText()
    return StaticConfiguration(kind: "AlarmWidget", provider: AlarmProvider()) { entry in
      AlarmWidgetView(entry: entry)
    }
    .configurationDisplayName(text.name)
    .description(text.description)
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
  }
}

@main
struct AlarmWidgetBundle: WidgetBundle {
  var body: some Widget {
    AlarmWidget()
  }
}
