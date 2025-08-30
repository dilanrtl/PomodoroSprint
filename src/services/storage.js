import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORE_KEYS } from '../config/constants';

export async function loadDurations() {
  try {
    const pairs = await AsyncStorage.multiGet(Object.values(STORE_KEYS));
    const map = Object.fromEntries(pairs || []);
    return {
      focusTime:  map[STORE_KEYS.focusTime],
      shortBreak: map[STORE_KEYS.shortBreak],
      longBreak:  map[STORE_KEYS.longBreak],
    };
  } catch { return {}; }
}

export async function saveDurations({ focusTime, shortBreak, longBreak }) {
  try {
    await AsyncStorage.multiSet([
      [STORE_KEYS.focusTime,  String(focusTime)],
      [STORE_KEYS.shortBreak, String(shortBreak)],
      [STORE_KEYS.longBreak,  String(longBreak)],
    ]);
  } catch {}
}
