import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar, TouchableOpacity, Text, Platform, Alert } from 'react-native';
import { useFonts } from 'expo-font';
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';

import PomodoroScreen from './src/screens/PomodoroScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { Colors } from './src/theme/colors';

const Stack = createNativeStackNavigator();

// 📌 Bildirim handler (uygulama ön planda iken bile bildirim gözüksün)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [fontsLoaded] = useFonts({
    'Poppins-Regular': Poppins_400Regular,
    'Poppins-Medium': Poppins_500Medium,
    'Poppins-SemiBold': Poppins_600SemiBold,
    'Poppins-Bold': Poppins_700Bold,
  });

  // 📌 Bildirim izinleri
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

  if (!fontsLoaded) return null;

  return (
    <NavigationContainer>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <Stack.Navigator>
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}
