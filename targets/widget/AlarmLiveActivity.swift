import SwiftUI
import WidgetKit
#if canImport(AlarmKit)
import AlarmKit
import ActivityKit

// iOS 26+ AlarmKit 알람의 잠금 화면·Dynamic Island 표시(다시 울림 카운트다운 등).
// Apple 문서: 카운트다운을 쓰는 앱은 위젯 확장에 AlarmAttributes용 ActivityConfiguration이 있어야 하며,
// 없으면 시스템이 알람을 닫아 버리고 울리지 않을 수 있다. 울림 화면(끄기/다시 울림) 자체는 시스템이 그린다.
// ⚠️ 메타데이터 타입 이름은 앱 모듈(modules/alarmapp-alarmkit/ios/AlarmappAlarmKitModule.swift)과 반드시 같아야 한다.
@available(iOS 26.0, *)
struct AlarmappAlarmMetadata: AlarmMetadata {}

@available(iOS 26.0, *)
struct AlarmLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: AlarmAttributes<AlarmappAlarmMetadata>.self) { context in
      HStack(spacing: 12) {
        Image(systemName: "alarm.fill").font(.title2).foregroundStyle(context.attributes.tintColor)
        VStack(alignment: .leading, spacing: 2) {
          Text(title(context.attributes, context.state)).font(.headline).lineLimit(1)
          remaining(context.state).font(.title3.monospacedDigit())
        }
        Spacer()
      }
      .padding()
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          Image(systemName: "alarm.fill").foregroundStyle(context.attributes.tintColor)
        }
        DynamicIslandExpandedRegion(.center) {
          Text(title(context.attributes, context.state)).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.trailing) {
          remaining(context.state).monospacedDigit()
        }
      } compactLeading: {
        Image(systemName: "alarm.fill").foregroundStyle(context.attributes.tintColor)
      } compactTrailing: {
        remaining(context.state).monospacedDigit().frame(maxWidth: 52)
      } minimal: {
        Image(systemName: "alarm.fill").foregroundStyle(context.attributes.tintColor)
      }
    }
  }

  private func title(_ a: AlarmAttributes<AlarmappAlarmMetadata>, _ s: AlarmPresentationState) -> LocalizedStringResource {
    switch s.mode {
    case .countdown: return a.presentation.countdown?.title ?? a.presentation.alert.title
    case .paused: return a.presentation.paused?.title ?? a.presentation.alert.title
    default: return a.presentation.alert.title
    }
  }

  @ViewBuilder
  private func remaining(_ s: AlarmPresentationState) -> some View {
    switch s.mode {
    case .countdown(let c):
      Text(timerInterval: Date.now...max(Date.now, c.fireDate), countsDown: true)
    case .alert(let a):
      Text(String(format: "%02d:%02d", a.time.hour, a.time.minute))
    default:
      Text("")
    }
  }
}
#endif
