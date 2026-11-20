# STM MEXA: local iOS release

The App Store Connect app uses bundle identifier `com.stmcnc.mexa` and company
team `LXXRDP97B2` (S AND T ENGINEERS PRIVATE LIMITED). Its first iOS version is
`1.0.0`, build `1`. Android remains at version code `3`.

Build locally with Xcode; no Expo account or cloud source upload is required.
Expo SDK 57 requires Xcode 26.4 or later. This Mac has Xcode 26.5, the iOS 26.5
SDK, Node 22.13.0, and CocoaPods 1.16.2.

## Privacy manifest and store label

The company confirmed that its published Apple privacy label accurately covers
the live S&T service providers. The native manifest therefore declares the same
seven collected data categories: Name, Email Address, User ID, Other User
Content, Customer Support, Product Interaction, and Other Data Types. Each is
linked to the user, used for App Functionality, and not used for tracking.

The declarations cover retained support and AI answer reports, user-linked
notification read times and alarm resolution, daily AI usage, and security
session IP and user-agent information. Keep the native manifest and the
published store label aligned when those practices change.

## Generate only the iOS project

Run from the `MobileApp` directory. Always provide the production API variable:
the environment in `eas.json` is not loaded by direct local builds.

```sh
export EXPO_PUBLIC_API_BASE_URL=https://stmapi.stmcnc.com/api
export EXPO_NO_TELEMETRY=1

./node_modules/.bin/expo prebuild --platform ios --no-clean --no-install \
  --skip-dependency-update react,react-native
pod install --project-directory=ios
```

Prebuild generates `ios/STMMEXA.xcworkspace` after CocoaPods installation.
Generated native folders are ignored by Git. Check the diff after prebuild:
Expo may change both package scripts from `expo start --android/--ios` to
`expo run:android/ios`; preserve the existing project scripts if those changes
are incidental. Do not regenerate Android for an iOS release.

## Build for screenshots and native verification

The simulator app is for local iPhone and iPad testing. It cannot be uploaded to
App Store Connect.

```sh
export EXPO_PUBLIC_API_BASE_URL=https://stmapi.stmcnc.com/api
export EXPO_NO_TELEMETRY=1
mkdir -p ../release-artifacts/stm-mexa-ios

xcodebuild -workspace ios/STMMEXA.xcworkspace -scheme STMMEXA \
  -configuration Release -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath ../release-artifacts/stm-mexa-ios/DerivedData \
  ARCHS=arm64 ONLY_ACTIVE_ARCH=YES CODE_SIGNING_ALLOWED=YES \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO build
```

The app is written to
`../release-artifacts/stm-mexa-ios/DerivedData/Build/Products/Release-iphonesimulator/STMMEXA.app`.
Keep simulator signing enabled with the local ad hoc identity (`-`). Xcode
embeds the app's simulated `application-identifier` entitlement, which its
secure token storage needs. Disabling signing is suitable for a compilation
check, but can prevent sign-in before an HTTP request is sent. This simulator
signing uses no Apple distribution certificate or private key.

Verify that the generated `STMMEXA.app-Simulated.xcent` contains
`application-identifier: LXXRDP97B2.com.stmcnc.mexa`, and that the compiled
executable includes that simulated entitlement. The normal code signature's
entitlements can be empty for a simulator build; inspect the simulated
entitlements as well. Test sign-in against the production service before
capturing store screenshots.

An unsigned device archive verifies the device build without using signing
credentials:

```sh
export EXPO_PUBLIC_API_BASE_URL=https://stmapi.stmcnc.com/api
export EXPO_NO_TELEMETRY=1

xcodebuild -workspace ios/STMMEXA.xcworkspace -scheme STMMEXA \
  -configuration Release -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath ../release-artifacts/stm-mexa-ios/DerivedData \
  -archivePath ../release-artifacts/stm-mexa-ios/STM-MEXA-1.0.0-1-unsigned.xcarchive \
  CODE_SIGNING_ALLOWED=NO archive
```

## Company signing and upload

An unsigned archive is a verification artifact, not an upload-ready release.
The local signing check could not find an S&T iOS development signing
certificate with its private key or a provisioning profile for
`com.stmcnc.mexa`. A company-signed archive and App Store upload are still
pending.

An authorized company developer must select the company team under the app
target's **Signing & Capabilities** and resolve the missing signing assets.
If Xcode reports `No Account for Team "LXXRDP97B2"`, complete the company
Apple ID sign-in under **Xcode → Settings → Accounts** and confirm that the
S&T team appears. A signed-in App Store Connect browser session does not
establish Xcode's signing session.
After those assets are configured locally, run this command from `MobileApp`
to create the signed Release archive with the production API explicitly set:

```sh
EXPO_PUBLIC_API_BASE_URL=https://stmapi.stmcnc.com/api EXPO_NO_TELEMETRY=1 \
xcodebuild -workspace ios/STMMEXA.xcworkspace -scheme STMMEXA \
  -configuration Release -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath ../release-artifacts/stm-mexa-ios/DerivedData \
  -archivePath ../release-artifacts/stm-mexa-ios/STM-MEXA-1.0.0-1-company.xcarchive \
  DEVELOPMENT_TEAM=LXXRDP97B2 CODE_SIGN_STYLE=Automatic archive
```

This command uses existing local signing assets. It does not enable remote
provisioning updates, create certificates or profiles, or upload the archive.
Verify the archive's app identifier, version, build number, signature, privacy
manifest, and bundled production API before distribution.

For an Xcode GUI archive, edit the ignored `ios/.xcode.env.local` file and add
`export EXPO_PUBLIC_API_BASE_URL=https://stmapi.stmcnc.com/api`. Preserve its
existing `NODE_BINARY` setting and all other entries. The generated bundle
build phase sources this file; a variable exported in a separate terminal
does not update an already-open Xcode process. Repeat this local configuration
if the native project is regenerated.

In Xcode Organizer, use **Distribute App → App Store Connect**. After Apple
processes the uploaded build, select version `1.0.0`, build `1`, in App Store
Connect and complete testing and review. Each replacement upload needs a new
`ios.buildNumber`; this does not require changing Android's version code.

References: [Expo SDK 57 requirements](https://docs.expo.dev/versions/v57.0.0/),
[Expo 57 app configuration](https://docs.expo.dev/versions/v57.0.0/config/app/),
[iOS manual submission](https://docs.expo.dev/submit/ios-manual/).
