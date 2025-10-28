import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native'; // Import Pressable and Alert
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import AsyncStorage
import { useRouter } from 'expo-router'; // Import useRouter

export default function ProfileScreen() {
  const router = useRouter(); // Get the router

  // Function to handle logout
  const handleLogout = async () => {
    try {
      // Remove the token from storage
      await AsyncStorage.removeItem("token");
      // Navigate back to the login screen (replace history)
      router.replace("/(auth)/login");
    } catch (error) {
      console.error("Error logging out:", error);
      Alert.alert("Logout Error", "Could not log out.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>
      {/* Add Logout Button */}
      <Pressable style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center', // Center content vertically
    alignItems: 'center', // Center content horizontally
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30, // Add more space below title
  },
  logoutButton: {
    backgroundColor: '#FF3B30', // Red color for logout
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20, // Space above the button
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});