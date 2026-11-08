import ExpoModulesCore
import WidgetKit

// iOS 위젯에 데이터 넘기기 — App Group 공유 폴더의 alarmapp/widget.json에 쓰고 위젯을 새로 그리게 한다.
// iOS는 위젯을 새로 그리는 횟수를 제한하므로 내용이 그대로면 아무것도 하지 않는다.
// 계산: src/utils/iosWidget.ts, 읽는 쪽: targets/widget/WidgetData.swift
public class AlarmappWidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AlarmappWidget")

    Function("update") { (json: String) in
      guard
        let base = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.com.danielpark.shared"),
        let data = json.data(using: .utf8)
      else { return }
      let dir = base.appendingPathComponent("alarmapp", isDirectory: true)
      let file = dir.appendingPathComponent("widget.json")
      if (try? Data(contentsOf: file)) == data { return }
      try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
      try? data.write(to: file, options: .atomic)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
