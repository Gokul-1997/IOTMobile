# STM MEXA: first Android release

| Item | Value |
| --- | --- |
| Google Play Console account | `it@stengineers.co.in` (existing S&T developer account) |
| Build and signing contact | `it@stmcnc.com` |
| App name | STM MEXA |
| Android package | `com.stmcnc.mexa` |
| Initial app version (`versionName`) | `1.0.0` |
| Current Android build (`versionCode`) | `2` |
| API | `https://stmapi.stmcnc.com/api` |

The two email addresses can differ. The app was built locally without a personal Expo account. The signed files are in `release-artifacts/stm-mexa-android` beside the `MobileApp` folder:

- `STM-MEXA-1.0.0-2-STMCNC.apk`: install directly on an Android test phone.
- `STM-MEXA-1.0.0-2-STMCNC.aab`: upload for the new Play Store listing.

Use the current build `2` files with the `STMCNC` suffix. Earlier build `1` files
and files without this suffix are superseded for new uploads. The app's displayed
name is **STM MEXA** and its package is **`com.stmcnc.mexa`**. Only upload the AAB
to a Play Console app registered with that exact package.

Before upload, verify that both files use the existing company upload certificate,
report `versionName` `1.0.0` and `versionCode` `2`, and include the same JavaScript
bundle and production API address. Confirm Android API 36 targeting, API 24 or
later support, and 16 KB native library alignment. Then complete physical phone
testing.

## Version codes and existing uploads

`1.0.0` is the initial app version shown to users. Build `2` is its Android upload
number; it does not make this app version `2.0.0`. Play has already used build code
`1`, so uploading another file with code `1` is rejected, even if its filename or
release name changes. Every new upload needs an unused, higher
`android.versionCode`; keep `expo.version` at `1.0.0` for this initial app release.
See [Android versioning](https://developer.android.com/studio/publish/versioning)
and the [Expo 57 app configuration reference](https://docs.expo.dev/versions/v57.0.0/config/app/).

If the intended build is already uploaded to this Play Console app, choose
**Add from library** in the destination track's release and select that build.
This reuses the same uploaded build across testing and production tracks without
uploading the file again. If a new binary is needed, rebuild with a higher version
code and upload that new AAB. See [Google's release guide](https://support.google.com/googleplay/android-developer/answer/9859348).

For these local builds, `app.json` holds the explicit Android build number and
`eas.json` uses `cli.appVersionSource: "local"`. Regenerate or synchronize the
native project from this configuration and check the actual signed files before
release. The paired APK and AAB are built together with the same code. The EAS
production profile still has `autoIncrement: true`, which advances the local build
number when that profile is used; preserve the updated value in source control.
Do not run separate auto-incrementing production builds when the APK and AAB must
have matching version codes. See [Expo's version management guide](https://docs.expo.dev/build-reference/app-versions/).

## 1. Test the APK

Install the signed APK on a test phone. Open the app, sign in with an authorized test account, and check machine pages, alarms, notifications, dark mode, and sign-out. Check that the AI tab is visible only when enabled for that account. Use approved test data for store screenshots.

## 2. Create the new app in Play Console

1. Sign in to [Google Play Console](https://play.google.com/console/) as `it@stengineers.co.in` and select the existing S&T developer account.
2. Choose **All apps → Create app**. Enter **STM MEXA** and `com.stmcnc.mexa` where requested. Select the default language, **App**, and the distribution/pricing settings approved by S&T.
3. Add a company-managed support contact. An authorized S&T account holder should review the required declarations and Play App Signing terms before confirming creation. See [Google’s app setup guide](https://support.google.com/googleplay/android-developer/answer/9859152).

## 3. Start with internal testing

1. Open **Test and release → Testing → Internal testing**, add the company’s testers, and create a release.
2. Configure [Play App Signing](https://developer.android.com/studio/publish/app-signing) when prompted, then upload the signed AAB. Keep the dedicated STM MEXA upload keystore and its passwords in S&T’s vault. Future updates must use the same package, an accepted upload key, and a higher version code.
3. Add release notes, save the draft, resolve any Console errors, and roll out to the internal testers once S&T approves. Share the tester opt-in link with those testers. See [Google’s testing guide](https://support.google.com/googleplay/android-developer/answer/9845334).
4. Test the Play-installed version on a phone. If the sideloaded APK uses the upload certificate and Play uses a different app-signing certificate, Android may require removing the sideloaded app before installing the Play version. Save any needed local settings first.

## 4. Complete the listing and reviewer access

- **Store listing:** add the descriptions, icon, feature graphic, and screenshots. Use the company’s approved assets and contact details.
- **App access:** this app requires a company-provisioned sign-in. Supply working credentials and instructions for a dedicated reviewer account with authorized test data. Enter them in **App content → App access**, where Google requests them. Keep them out of release notes, chat, and source control.
- **Privacy and deletion:** the public [privacy policy](https://stmmexa.stmcnc.com/privacy.html) loaded without a login and contains the [web deletion instructions](https://stmmexa.stmcnc.com/privacy.html#delete). The app links to the policy and offers an account deletion request under **Profile → Privacy & support**. Check both paths on the test phone before submission.
- **Data safety and app content:** have S&T verify the declarations against the deployed service and app. Review company account data, sign-in and change records, requested emails, and the optional AI service’s question and report-data handling when enabled and authorized. Complete the ads, target audience, and content rating forms as prompted. See [Google’s review checklist](https://support.google.com/googleplay/android-developer/answer/9859455) and [Data safety guide](https://support.google.com/googleplay/android-developer/answer/10787469).

## 5. Choose distribution and submit

For a public listing, promote the tested build or create the production release in the approved countries. Review **Publishing overview**, then submit it for review after S&T approves the launch. If distribution must be limited to managed company devices, decide that before public rollout and follow [Managed Google Play private app setup](https://support.google.com/googleplay/android-developer/answer/9874937). Using a company developer account does not make a production listing private.

**Timing:** APK testing can start as soon as the signed APK is available. Internal testing commonly becomes available within minutes after publication, but the first opt-in link can take several hours and an initial release can require review. Google says review can take a few hours to seven days, sometimes longer; allow at least a week from submission to public launch. Check the actual status in [Publishing overview](https://support.google.com/googleplay/android-developer/answer/9859654).
