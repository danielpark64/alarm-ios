#!/bin/zsh
# 교대알람 TestFlight에 올리기(말하는 사진첩 scripts/testflight.sh를 옮김, 2026-11-09) — Xcode 로그인이 풀려 있어도 App Store Connect API 키(관리자 권한)로 서명·업로드한다.
# 사용: npm run testflight          빌드 번호 +1 → 아카이브 → 업로드
#       npm run testflight -- check  번호 그대로, 올리지 않고 서명까지만 시험(내보낸 ipa는 지움)
# 키 설정: ~/.appstoreconnect/upload-key 에 KEY_ID=… / ISSUER=… 두 줄, 파일은 ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8
#   '앱 관리' 키는 클라우드 배포 인증서를 못 써서 실패한다(2026-11-01) — 꼭 '관리자' 키
# 키가 없거나 실패하면 Xcode 로그인으로 한 번 더 시도한다
set -e -o pipefail
MODE=${1:-upload}
cd "$(dirname "$0")/.."
ROOT=$PWD
export LANG=en_US.UTF-8
PLIST=ios/app/Info.plist
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# 알람 파일을 고친 상태로 올리지 않도록 정적 검사부터(FAIL이면 중단)
if [[ $MODE != check ]]; then
  ./scripts/test-alarm-suite.sh --static > $WORK/static.log 2>&1 || { tail -30 $WORK/static.log; echo "✗ 정적 검사 실패 — 고친 뒤 다시"; exit 1; }
  echo "▶ 정적 검사 통과"
fi

# 바탕화면(iCloud)이 만든 ' 2' 중복 파일이 있으면 코드젠이 duplicate symbol로 죽는다 — 지운다
find ios/build/generated ios/Pods/Headers -name '* [0-9].*' -delete 2>/dev/null || true

# 빌드 번호(app.json·project.pbxproj(앱·위젯·공유 타깃 전부)·Info.plist를 같이)
BUILD=$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' $PLIST)
if [[ $MODE != check ]]; then
  BUILD=$((BUILD + 1))
  sed -i '' -E "s/(\"buildNumber\": \")[0-9]+\"/\1$BUILD\"/" app.json
  sed -i '' -E "s/CURRENT_PROJECT_VERSION = [0-9]+;/CURRENT_PROJECT_VERSION = $BUILD;/" ios/app.xcodeproj/project.pbxproj
  /usr/libexec/PlistBuddy -c "Set CFBundleVersion $BUILD" $PLIST
fi
VERSION=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' $PLIST)
echo "▶ 교대알람 $VERSION ($BUILD) — $MODE"

# API 키
AUTH=()
if [[ -f ~/.appstoreconnect/upload-key ]]; then
  source ~/.appstoreconnect/upload-key
  KEYFILE=~/.appstoreconnect/private_keys/AuthKey_$KEY_ID.p8
  if [[ -f $KEYFILE ]]; then
    AUTH=(-authenticationKeyPath $KEYFILE -authenticationKeyID $KEY_ID -authenticationKeyIssuerID $ISSUER)
    echo "▶ API 키 $KEY_ID 사용"
  fi
fi
[[ ${#AUTH} -eq 0 ]] && echo "▶ API 키 없음 — Xcode 로그인으로"

# 아카이브(산출물은 iCloud 바탕화면 밖에)
ARCHIVE=~/Library/Developer/Xcode/Archives/AlarmApp-$VERSION-$BUILD.xcarchive
rm -rf $ARCHIVE
cd ios
xcodebuild -workspace app.xcworkspace -scheme app -configuration Release \
  -destination 'generic/platform=iOS' -archivePath $ARCHIVE \
  -derivedDataPath ~/Library/Developer/Xcode/DerivedData/alarmapp-manual \
  -allowProvisioningUpdates $AUTH archive > $WORK/archive.log 2>&1 \
  || { grep -E "error:" $WORK/archive.log | head -20; echo "✗ 아카이브 실패"; exit 1; }
echo "▶ 아카이브 완료"

DEST=$([[ $MODE == check ]] && echo export || echo upload)
cat > $WORK/ExportOptions.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>method</key><string>app-store-connect</string>
<key>destination</key><string>$DEST</string>
<key>teamID</key><string>T5Z6ACK2PU</string>
<key>signingStyle</key><string>automatic</string>
<key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
EOF

export_with() {
  xcodebuild -exportArchive -archivePath $ARCHIVE -exportOptionsPlist $WORK/ExportOptions.plist \
    -exportPath $WORK/out -allowProvisioningUpdates "$@" > $WORK/export.log 2>&1
}
if export_with $AUTH; then
  :
elif [[ ${#AUTH} -gt 0 ]] && { grep -E "error:" $WORK/export.log | head -4; echo "▶ 키로 실패 — Xcode 로그인으로 다시"; export_with; }; then
  :
else
  grep -E "error:" $WORK/export.log | head -10
  echo "✗ 내보내기 실패 — Xcode 로그인 또는 관리자 API 키가 필요해요"
  exit 1
fi
if [[ $MODE == check ]]; then
  echo "✓ 서명 시험 통과 ($VERSION/$BUILD, 올리지 않음)"
else
  echo "✓ TestFlight 업로드 완료 ($VERSION/$BUILD) — 처리에 10~30분"
fi
