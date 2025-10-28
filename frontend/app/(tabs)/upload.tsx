import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator, // For loading state during upload
  Platform, // To handle platform-specific details if needed
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

// ====================================================================
//  TypeScript Type Definitions
// ====================================================================

// Structure for the result from the image picker
type ImagePickerAsset = {
  uri: string;
  type?: string | null; // Mime type (e.g., 'image/jpeg')
  fileName?: string | null; // Original filename
};

// Structure for the response from the /upload/image endpoint
type FilePathResponse = {
  file_path: string; // e.g., "/uploads/my_image.jpg"
};

// ====================================================================
//  UploadScreen Component 📱
// ====================================================================

export default function UploadScreen() {
  const [description, setDescription] = useState('');
  const [imageAsset, setImageAsset] = useState<ImagePickerAsset | null>(null); // Holds selected image details
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  // --- Function to pick an image ---
  const pickImage = async () => {
    // Request permission (important for iOS)
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert("Permission Required", "Allow access to your photos to upload images.");
      return;
    }

    // Launch gallery
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Correct property for images
      allowsEditing: true,
      aspect: [1, 1], // Square crop
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      // Get the first selected asset
      const asset = result.assets[0];
      // Store the necessary details (uri is essential)
      setImageAsset({
        uri: asset.uri,
        type: asset.mimeType, // Get mime type if available
        fileName: asset.fileName || `photo_${Date.now()}.jpg`, // Generate a filename if needed
      });
    }
  };

  // --- Function to handle the upload process ---
  const handleUpload = async () => {
    if (!imageAsset) {
      Alert.alert("No Image Selected", "Please select an image first.");
      return;
    }
    if (isLoading) return; // Prevent multiple uploads
    setIsLoading(true);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Authentication Error", "Please log in again.");
        router.replace("/(auth)/login");
        setIsLoading(false);
        return;
      }

      // --- Step 1: Upload the Image File ---
      // Create FormData to send the file
      const formData = new FormData();
      // Append the file. The key 'file' MUST match the backend endpoint parameter name.
      formData.append('file', {
        uri: imageAsset.uri,
        // Use a generic type if specific type isn't available, or derive from URI extension
        type: imageAsset.type || 'image/jpeg',
        name: imageAsset.fileName || 'upload.jpg',
      } as any); // Use 'as any' to bypass strict type checking for FormData append if needed


      const uploadResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/upload/image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          // 'Content-Type': 'multipart/form-data' // fetch automatically sets this for FormData
        },
        body: formData,
      });

      if (uploadResponse.status === 401) throw new Error("Session Expired");
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.detail || `Image upload failed: ${uploadResponse.statusText}`);
      }

      const uploadResult: FilePathResponse = await uploadResponse.json();
      const mediaUrlFromServer = uploadResult.file_path; // e.g., "/uploads/image.jpg"

      // --- Step 2: Create the Post with the Image URL ---
      const postResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description,
          media_url: mediaUrlFromServer, // Send the path received from the upload endpoint
        }),
      });

       if (postResponse.status === 401) throw new Error("Session Expired"); // Check again
       if (!postResponse.ok) {
        const errorData = await postResponse.json();
        throw new Error(errorData.detail || `Post creation failed: ${postResponse.statusText}`);
      }

      // Success!
      Alert.alert("Upload Successful", "Your post has been created.");
      setImageAsset(null); // Clear image preview
      setDescription(''); // Clear description
      // Navigate to the Feed screen after successful upload
      router.push('/(tabs)'); // Navigate to the feed (index) within the tabs group

    } catch (error) {
      console.error("Error during upload:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.message === "Session Expired") {
         Alert.alert("Session Expired", "Please log in again.");
         await AsyncStorage.removeItem("token");
         router.replace("/(auth)/login");
      } else {
        Alert.alert("Upload Failed", error instanceof Error ? error.message : "An unexpected error occurred.");
      }
    } finally {
      setIsLoading(false); // Ensure loading indicator stops
    }
  };

  // --- Render UI ---
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create New Post</Text>

      {/* Image Picker Area */}
      <Pressable style={styles.imagePicker} onPress={pickImage}>
        {imageAsset ? (
          <Image source={{ uri: imageAsset.uri }} style={styles.imagePreview} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Ionicons name="camera-outline" size={40} color="#888" />
            <Text style={styles.imagePickerText}>Select Image</Text>
          </View>
        )}
      </Pressable>

      {/* Description Input */}
      <TextInput
        style={styles.input}
        placeholder="Write a description..."
        value={description}
        onChangeText={setDescription}
        multiline
      />

      {/* Upload Button */}
      <Pressable
        style={[styles.button, (isLoading || !imageAsset) && styles.buttonDisabled]}
        onPress={handleUpload}
        disabled={isLoading || !imageAsset} // Disable if loading or no image selected
      >
        {isLoading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Upload Post</Text>
        )}
      </Pressable>
    </View>
  );
}

// ====================================================================
//  Styles
// ====================================================================

const styles = StyleSheet.create({
  // (Styles remain largely the same as the previous version)
   container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  imagePicker: {
    width: '100%',
    aspectRatio: 1, // Make it square
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePickerText: {
    color: '#888',
    marginTop: 5,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  input: {
    minHeight: 100, // Slightly taller for description
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 20,
    paddingHorizontal: 12, // Use horizontal padding
    paddingTop: 12,       // Consistent padding top
    paddingBottom: 12,    // Add padding bottom
    fontSize: 16,
    textAlignVertical: 'top',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row', // Allow indicator and text side-by-side
    justifyContent: 'center', // Center content horizontally
    minHeight: 50, // Ensure button has a consistent height
  },
  buttonDisabled: {
    backgroundColor: '#99c2ff',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5, // Space text away from indicator if loading
  },
});