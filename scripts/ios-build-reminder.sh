#!/bin/bash
# iOS 빌드 후 자동 호출 — 6일 후 재설치 리마인더를 iCloud 리마인더에 등록
# iCloud를 통해 폰에도 자동 동기화됨

BUILD_DATE=$(date '+%Y-%m-%d %H:%M')

osascript <<EOF
tell application "Reminders"
  -- 기존 만료 리마인더 삭제 (중복 방지)
  set existingReminders to (reminders whose name contains "교대알람 iOS 재설치")
  repeat with r in existingReminders
    delete r
  end repeat

  -- 6일 후 리마인더 등록
  set dueDate to (current date) + (6 * days)
  set newReminder to make new reminder with properties {¬
    name:"🔔 교대알람 iOS 재설치 필요 — 내일이면 7일 만료", ¬
    body:"빌드일: $BUILD_DATE / 폰·미니 앱 재설치 후 7일 연장", ¬
    due date:dueDate, ¬
    remind me date:dueDate}
end tell

return "리마인더 등록 완료: 6일 후 알림"
EOF