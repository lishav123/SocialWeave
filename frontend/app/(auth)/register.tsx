import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Pressable,
    StyleSheet,
    Alert
} from 'react-native';
import { useRouter, Link } from 'expo-router'; // Import Link for navigation

export default function RegisterScreen() {
    // State for each input field
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [location, setLocation] = useState(""); // Optional field
    const [isLoading, setIsLoading] = useState(false);

    const router = useRouter();

    const handleRegister = async () => {
        if (isLoading) return;
        setIsLoading(true);

        // Basic validation (you might want more robust checks)
        if (!email || !username || !password) {
            Alert.alert("Missing Fields", "Please fill in email, username, and password.");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/register`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                // Send all the required fields
                body: JSON.stringify({
                    email: email,
                    username: username,
                    password: password,
                    location: location || null, // Send null if location is empty
                }),
            });

            const data = await response.json();

            // Check if the backend responded successfully (status 200)
            if (response.ok) {
                Alert.alert("Registration Successful", "Please log in with your new account.");
                // Navigate back to the login screen after successful registration
                router.push("/(auth)/login");
            } else if (data.detail) {
                // Show specific errors from the backend (like "Email already exists")
                Alert.alert("Registration Failed", data.detail);
            } else {
                Alert.alert("Registration Failed", `An unknown error occurred. Status: ${response.status}`);
            }

        } catch (error) {
            console.error("Error registering:", error);
            Alert.alert("Registration Error", "Could not connect to the server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Create Account</Text>

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
                placeholder="Username"
                autoCapitalize="none"
                value={username}
                onChangeText={setUsername}
            />

            <TextInput
                style={styles.input}
                placeholder="Password"
                secureTextEntry={true}
                value={password}
                onChangeText={setPassword}
            />

            <TextInput
                style={styles.input}
                placeholder="Location (Optional)"
                value={location}
                onChangeText={setLocation}
            />

            <Pressable
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={isLoading}
            >
                <Text style={styles.buttonText}>
                    {isLoading ? "Registering..." : "Register"}
                </Text>
            </Pressable>

            {/* Add a link to navigate back to the Login screen */}
            <Link href="/(auth)/login" style={styles.loginLink}>
                Already have an account? Login
            </Link>
        </View>
    );
}

// Re-use similar styles from LoginScreen, maybe adjust padding/margins
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
        marginTop: 10, // Add some margin above the button
    },
    buttonDisabled: {
        backgroundColor: '#99c2ff',
    },
    buttonText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    loginLink: {
        marginTop: 20,
        color: '#007AFF',
        textAlign: 'center',
        fontSize: 16,
    },
});