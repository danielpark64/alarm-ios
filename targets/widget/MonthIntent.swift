import AppIntents
import WidgetKit

// 달력 위젯의 ‹ › 버튼 — 버튼은 iOS 17부터라 16에서는 이번 달만 보여 준다.
@available(iOS 17.0, *)
struct MonthIntent: AppIntent {
  static var title: LocalizedStringResource = "Change month"
  static var isDiscoverable: Bool = false

  @Parameter(title: "Months")
  var delta: Int

  init() {}
  init(delta: Int) { self.delta = delta }

  func perform() async throws -> some IntentResult {
    let now = Date()
    if let next = widgetCalendar.date(byAdding: .month, value: delta, to: ViewedMonth.current(at: now)),
       WidgetData.load()?.hasMonth(next) == true {
      ViewedMonth.set(next, at: now)
    }
    return .result()
  }
}
