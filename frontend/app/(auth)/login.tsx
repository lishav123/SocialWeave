import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  Pressable, 
  StyleSheet, 
  Alert // 1. Import Alert to show errors
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // 2. Add a "loading" state to disable the button
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();

  // 3. Make the function async
  const handleLogin = async () => {
    // Don't do anything if we're already logging in
    if (isLoading) return;
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          password: password,
        }),
      });

      const data = await response.json();

      // 4. Check if we got a token (success) or a detail (error)
      if (data.access_token) {
        // --- THIS IS YOUR PLAN ---
        // 1. Save the token
        await AsyncStorage.setItem("token", data.access_token);
        
        // 2. Move to the main page
        // We use "replace" so the user can't go "back" to the login screen
        router.replace("/(tabs)");
        // -------------------------
        
      } else if (data.detail) {
        // If the server sent an error (like "Wrong password")
        Alert.alert("Login Failed", data.detail);
      } else {
        // Generic error
        Alert.alert("Login Failed", "An unknown error occurred.");
      }

    } catch (error) {
      console.error("Error logging in:", error);
      Alert.alert("Login Error", "Could not connect to the server.");
    } finally {
      // 5. Re-enable the button whether it succeeded or failed
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back!</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry={true}
        value={password}
        onChangeText={setPassword}
      />

      {/* 6. Disable the button while loading */}
      <Pressable 
        style={[styles.button, isLoading && styles.buttonDisabled]} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        <Text style={styles.buttonText}>
          {isLoading ? "Logging in..." : "Login"}
        </Text>
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
    backgroundColor: '#fff', 
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 44, 
    borderColor: '#ccc', 
    borderWidth: 1,
    borderRadius: 8, 
    marginBottom: 16,
    paddingLeft: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14, 
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#99c2ff', 
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});