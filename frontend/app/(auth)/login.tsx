import React from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back!</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry={true} // This hides the password
      />

      <Pressable style={styles.button} onPress={() => {}}>
        <Text style={styles.buttonText}>Login</Text>
      </Pressable>
    </View>
  );
}

// A basic stylesheet to make it look decent
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 12,
    paddingLeft: 10,
  },
  button: {
    backgroundColor: '#007AFF', // A nice blue
    padding: 12,
    borderRadius: 5,
    alignItems: 'center', // Center the text
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});