import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useAuth } from '../features/auth/AuthProvider';
import { Colors } from '../theme/colors';

export default function SignInScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState(''); const [pw, setPw] = useState('');

  async function onSubmit() {
    try { await signIn(email.trim(), pw); }
    catch (e) { Alert.alert('Giriş Hatası', e.message); }
  }

  return (
    <View style={[styles.wrap, { backgroundColor: Colors.background }]}>
      <Text style={styles.title}>Giriş Yap</Text>
      <TextInput style={styles.input} placeholder="E-posta" autoCapitalize="none" onChangeText={setEmail} />
      <TextInput style={styles.input} placeholder="Şifre" secureTextEntry onChangeText={setPw} />
      <TouchableOpacity style={styles.btn} onPress={onSubmit}><Text style={styles.btnText}>Giriş</Text></TouchableOpacity>
      <Text style={styles.link} onPress={() => navigation.navigate('SignUp')}>Hesabın yok mu? Kayıt ol</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap:{ flex:1, alignItems:'center', justifyContent:'center', padding:24 },
  title:{ fontSize:24, fontWeight:'700', color:Colors.text, marginBottom:16 },
  input:{ width:'100%', borderWidth:1, borderColor:'#EDEDED', borderRadius:12, padding:12, marginVertical:6, backgroundColor:'#fff' },
  btn:{ backgroundColor:Colors.primary, padding:14, borderRadius:12, marginTop:10, width:'100%', alignItems:'center' },
  btnText:{ color:'#fff', fontWeight:'700' },
  link:{ color:Colors.secondary, marginTop:12, fontWeight:'600' }
});
