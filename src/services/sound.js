// src/services/sound.js
import { Audio } from 'expo-av';

// Basit bir önbellek: aynı sesi tekrar tekrar yüklemeyelim
const cache = new Map();

/** Uygulama açılışında ses modunu ayarla ve kritik sesleri preload et. */
export async function prepare() {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true, // iOS sessiz modda da çalsın
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      allowsRecordingIOS: false,
      interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
      interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
    });

    // En sık kullanılanları önden yükle (isteğe bağlı)
    await Promise.all([
      load('work'),
      load('short'),
      load('long'),
      load('chime'),
    ]);
  } catch (e) {
    console.warn('Audio prepare error:', e);
  }
}

/** Faz adına göre require edilen mp3 modülünü döndür. */
function moduleFor(name) {
  switch (name) {
    case 'work':
      return require('../../assets/sounds/work.mp3');
    case 'short':
      return require('../../assets/sounds/short.mp3');
    case 'long':
      return require('../../assets/sounds/long.mp3');
    case 'chime':
    default:
      return require('../../assets/sounds/chime.mp3');
  }
}

/** Sesi yükle ve cache’e koy. */
async function load(name) {
  if (cache.has(name)) return cache.get(name);
  const sound = new Audio.Sound();
  await sound.loadAsync(moduleFor(name), { shouldPlay: false, volume: 1.0 });
  cache.set(name, sound);
  return sound;
}

/** Tek sefer çal (overlap istemiyorsan önce stop et). */
export async function play(name = 'chime') {
  try {
    const snd = await load(name);
    // Aynı sesi hızlıca tekrar tetiklersen önce başa sar:
    try { await snd.stopAsync(); } catch {}
    await snd.setPositionAsync(0);
    await snd.playAsync();
  } catch (e) {
    console.warn('Audio play error:', e);
  }
}

/** Uygulama kapanırken kaynakları bırak. */
export async function unloadAll() {
  const tasks = [];
  cache.forEach((snd) => tasks.push(snd.unloadAsync().catch(() => {})));
  await Promise.all(tasks);
  cache.clear();
}
