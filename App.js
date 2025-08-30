// App.js
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, TouchableOpacity, Text, Platform, Alert, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

// Auth
import { AuthProvider, useAuth } from './src/features/auth/AuthProvider';

// Ekranlar
import PomodoroScreen from './src/screens/PomodoroScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import SignInScreen from './src/screens/SignInScreen';
import SignUpScreen from './src/screens/SignUpScreen';

// Tema
import { Colors } from './src/theme/colors';

// Ses servisi (varsa preload/unload için)
import * as Sound from './src/services/sound';

const Stack = createNativeStackNavigator();

// --- Uygulama ön planda mı? Bildirim handler'ı buna bakacak ---
let isForeground = true;

// Bildirim handler (SDK 53+)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: !isForeground, // ön planda banner gösterme
    shouldShowList:   !isForeground,
    shouldPlaySound:  !isForeground, // ön planda sesi biz çalıyoruz
    shouldSetBadge: false,
  }),
});

function AuthAwareNavigator() {
  const { user } = useAuth();

  return (
    <Stack.Navigator>
      {user ? (
        <>
          <Stack.Screen
            name="Pomodoro"
            component={PomodoroScreen}
            options={({ navigation }) => ({
              title: 'Pomodoro Sprint',
              headerStyle: { backgroundColor: Colors.background },
              headerTitleStyle: { fontFamily: 'Poppins-SemiBold' },
              headerRight: () => (
                <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                  <Text
                    style={{
                      marginRight: 15,
                      color: Colors.primary,
                      fontWeight: 'bold',
                      fontSize: 18,
                    }}
                  >
                    ⚙️
                  </Text>
                </TouchableOpacity>
              ),
            })}
          />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{
              title: 'Ayarlar',
              headerStyle: { backgroundColor: Colors.background },
              headerTitleStyle: { fontFamily: 'Poppins-SemiBold' },
            }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ title: 'Giriş' }} />
          <Stack.Screen name="SignUp" component={SignUpScreen} options={{ title: 'Kayıt Ol' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  // Bildirim izinleri
  useEffect(() => {
    (async () => {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        const { status: newStatus } = await Notifications.requestPermissionsAsync();
        if (newStatus !== 'granted') {
          if (Platform.OS === 'ios') {
            Alert.alert(
              'Bildirim İzni Gerekli',
              'Pomodoro bildirimlerini almak için Ayarlar > Bildirimler kısmından izin verin.'
            );
          } else {
            alert('Bildirim izni verilmedi.');
          }
        }
      }
    })();
  }, []);

  // Foreground/Background takibi
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      isForeground = (s === 'active');
    });
    return () => sub.remove();
  }, []);

  // Ses modunu hazırla + preload (opsiyonel)
  useEffect(() => {
    Sound?.prepare?.();
    return () => {
      Sound?.unloadAll?.();
    };
  }, []);

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
        <AuthAwareNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
