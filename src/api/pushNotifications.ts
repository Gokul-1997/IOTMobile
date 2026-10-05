import * as Device from 'expo-device';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

// Firebase (FCM) is the committed push provider — we register the native
// device token (FCM on Android, APNs on iOS) rather than Expo's push service.

// Expo Go on Android has had no remote push since SDK 53, and loading
// expo-notifications there throws while the app starts (a red screen before
// sign-in), so the module is loaded only where push exists: a real build on
// either platform, or Expo Go on iOS.
const pushAvailable = !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
const Notifications: typeof import('expo-notifications') | null = pushAvailable ? require('expo-notifications') : null;

Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Notifications || !Device.isDevice) {
    // Push tokens are not available on simulators/emulators, nor in Expo Go on Android.
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const { data: deviceToken } = await Notifications.getDevicePushTokenAsync();
  // TODO: send deviceToken to POST /api/notifications/register-device once that endpoint exists.
  return deviceToken;
}
