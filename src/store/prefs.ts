import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/* Small device preferences (not secrets). The same store the tokens use, as
   it is the only one this app carries; on the web preview, localStorage. */
const isWeb = Platform.OS === 'web';

export async function getPref(key: string): Promise<string | null> {
  try {
    return isWeb ? window.localStorage.getItem(key) : await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setPref(key: string, value: string): Promise<void> {
  try {
    if (isWeb) window.localStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  } catch {
    /* a preference that cannot be saved is simply not remembered */
  }
}
