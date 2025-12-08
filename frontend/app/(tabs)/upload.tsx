import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Image,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function UploadScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      setImage(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!image) {
      Alert.alert("No Image", "Please select an image first.");
      return;
    }
    setIsUploading(true);

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) { router.replace("/(auth)/login"); return; }

      // 1. Upload Image
      const formData = new FormData();
      const filename = `upload_${Date.now()}.jpg`;
      
      formData.append('file', {
        uri: image,
        name: filename,
        type: 'image/jpeg',
      } as any);

      const uploadRes = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/upload/image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Image upload failed");
      const uploadData = await uploadRes.json();
      const serverFilePath = uploadData.file_path;

      // 2. Create Post
      const postRes = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description,
          media_url: serverFilePath,
        }),
      });

      if (!postRes.ok) throw new Error("Post creation failed");

      // Reset & Redirect
      Alert.alert("Success", "Post uploaded!");
      setImage(null);
      setDescription('');
      router.push("/(tabs)"); 

    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Upload failed. Check connection.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Upload</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          
          {/* 1. Big Image Picker Area */}
          <Pressable onPress={pickImage} style={styles.imageContainer}>
            {image ? (
              <Image source={{ uri: image }} style={styles.previewImage} />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="cloud-upload-outline" size={60} color="#007AFF" />
                <Text style={styles.placeholderText}>Tap to select an image</Text>
              </View>
            )}
            {/* Overlay Icon to change image if already selected */}
            {image && (
              <View style={styles.editIconOverlay}>
                <Ionicons name="pencil" size={20} color="#fff" />
              </View>
            )}
          </Pressable>

          {/* 2. Caption Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Caption</Text>
            <TextInput
              style={styles.input}
              placeholder="What's on your mind?"
              multiline
              value={description}
              onChangeText={setDescription}
              placeholderTextColor="#999"
            />
          </View>

        </ScrollView>

        {/* 3. Big Bottom Button */}
        <View style={styles.footer}>
          <Pressable 
            style={[styles.postBtn, (!image || isUploading) && styles.disabledBtn]} 
            onPress={handleUpload}
            disabled={!image || isUploading}
          >
            {isUploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </Pressable>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center', // Center the title
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  content: {
    padding: 20,
  },
  // Big Image Styles
  imageContainer: {
    width: '100%',
    aspectRatio: 1, // Makes it a square
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 25,
    backgroundColor: '#f8f9fa',
    borderWidth: 2,
    borderColor: '#e1e8ed',
    borderStyle: 'dashed', // Nice dashed border effect
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    marginTop: 10,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  editIconOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
    borderRadius: 20,
  },
  // Input Styles
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#f0f2f5',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    minHeight: 100, // Tall input box
    textAlignVertical: 'top',
    color: '#000',
  },
  // Footer Button Styles
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  postBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5, // Android shadow
  },
  disabledBtn: {
    backgroundColor: '#A0CFFF',
    shadowOpacity: 0,
    elevation: 0,
  },
  postBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});