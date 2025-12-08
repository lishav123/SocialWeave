import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';

// Type matching our UserRead from backend
type UserProfile = {
  id: number;
  username: string;
  bio?: string | null;
  profile_pic?: string | null;
};

export default function EditProfileScreen() {
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [image, setImage] = useState<string | null>(null); // Local URI for preview
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const router = useRouter();

  // --- Load Current Data ---
  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;

        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
          headers: { "Authorization": `Bearer ${token}` },
        });
        
        if (response.ok) {
          const data: UserProfile = await response.json();
          setUsername(data.username);
          setBio(data.bio || '');
          if (data.profile_pic) {
             setImage(`${process.env.EXPO_PUBLIC_API_URL}${data.profile_pic}`);
          }
        }
      } catch (error) {
        console.error("Failed to load profile", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadUserData();
  }, []);

  // --- Pick Image ---
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
    
    // Use MediaTypeOptions which is the standard enum
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], // Square for profile pics
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  // --- Save Changes ---
  const handleSave = async () => {
    if (!username.trim()) {
      Alert.alert("Error", "Username cannot be empty");
      return;
    }
    
    // Valid character check (optional, but good practice)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
        Alert.alert("Invalid Username", "Username can only contain letters, numbers, and underscores.");
        return;
    }

    setIsSaving(true);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("No token");

      let profilePicPath = null;

      // 1. If image is a local URI (new upload), upload it first
      if (image && !image.startsWith('http')) {
        const formData = new FormData();
        // Unique filename to prevent caching issues
        const filename = image.split('/').pop() || `profile_${Date.now()}.jpg`;
        
        formData.append('file', {
          uri: image,
          type: 'image/jpeg',
          name: filename,
        } as any);

        const uploadResp = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/upload/image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        
        if (!uploadResp.ok) throw new Error("Failed to upload image");
        const uploadResult = await uploadResp.json();
        profilePicPath = uploadResult.file_path;
      }

      // 2. Update Profile Data (Username & Bio)
      const updateData = {
        username: username,
        bio: bio,
        ...(profilePicPath && { profile_pic: profilePicPath }), // Only send if new image
      };

      const updateResp = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      // --- ERROR HANDLING FOR USERNAME ---
      if (!updateResp.ok) {
         const err = await updateResp.json();
         // Backend returns { detail: "Username already taken" }
         if (updateResp.status === 400 && err.detail === "Username already taken") {
             Alert.alert("Unavailable", `The username "${username}" is already taken. Please try another.`);
         } else {
             throw new Error(err.detail || "Update failed");
         }
         return; // Stop here if error
      }

      // Success
      Alert.alert("Success", "Profile updated!");
      router.back(); 

    } catch (error) {
      console.error(error);
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container}>
          
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <Pressable onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#007AFF"/> : <Text style={styles.saveText}>Done</Text>}
            </Pressable>
          </View>

          <View style={styles.form}>
            {/* Image Picker */}
            <Pressable style={styles.imageContainer} onPress={pickImage}>
              {image ? (
                <Image source={{ uri: image }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.placeholder]}>
                  <Ionicons name="camera" size={40} color="#999" />
                </View>
              )}
              <Text style={styles.changePhotoText}>Change Profile Photo</Text>
            </Pressable>

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Username</Text>
              <TextInput 
                style={styles.input} 
                value={username} 
                onChangeText={setUsername}
                autoCapitalize="none"
                placeholder="Enter username"
                placeholderTextColor="#ccc"
              />
              <Text style={styles.hint}>Used for search and mentions.</Text>
            </View>

            {/* Bio Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput 
                style={[styles.input, styles.bioInput]} 
                value={bio} 
                onChangeText={setBio}
                multiline
                maxLength={150}
                placeholder="Write something about yourself..."
                placeholderTextColor="#ccc"
              />
              <Text style={styles.hint}>{bio.length} / 150</Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#fff', 
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 
  },
  container: {
    backgroundColor: '#fff',
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cancelText: { fontSize: 16, color: '#000' },
  saveText: { fontSize: 16, color: '#007AFF', fontWeight: 'bold' },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  form: {
    padding: 20,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  placeholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    color: '#007AFF',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    color: '#666',
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    paddingVertical: 10,
    fontSize: 16,
    color: '#000',
  },
  bioInput: {
    minHeight: 60,
    textAlignVertical: 'top', 
  },
  hint: {
      marginTop: 5,
      fontSize: 12,
      color: '#888',
      textAlign: 'right',
  }
});