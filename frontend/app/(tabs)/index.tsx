import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  Alert, 
  Image, 
  ActivityIndicator 
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// ====================================================================
//  TypeScript Type Definitions ("Blueprints" 📖 for our data)
// ====================================================================

// This defines the expected structure of a User "receipt" from our backend
type UserRead = {
  id: number;
  username: string;
  location?: string | null; // Optional, can be string or null
};

// This defines the expected structure of a Post "receipt" from our backend
type PostRead = {
  id: number;
  description: string;
  media_url: string | null; // Can be a string (URL) or null
  user: UserRead; // A post has a nested UserRead object for its author
  // We're not using comments/likes yet, but they'd be like:
  // comments: CommentRead[];
  // likes: LikeRead[];
};

// ====================================================================
//  FeedScreen Component
// ====================================================================

export default function FeedScreen() {
  // Use 'PostRead[]' to tell TypeScript that 'posts' is an array of PostRead objects
  const [posts, setPosts] = useState<PostRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchFeed = async () => {
      try {
        const token = await AsyncStorage.getItem("token");

        if (!token) {
          Alert.alert("Authentication Required", "Please log in to view your feed.");
          router.replace("/(auth)/login");
          return;
        }

        const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/feed`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`
          },
        });

        if (response.status === 401) {
          Alert.alert("Session Expired", "Your session has expired. Please log in again.");
          await AsyncStorage.removeItem("token");
          router.replace("/(auth)/login");
          return;
        }

        if (!response.ok) {
          // Attempt to parse error details from backend
          const errorData = await response.json();
          const errorMessage = errorData.detail || `Failed to fetch feed: ${response.statusText}`;
          throw new Error(errorMessage);
        }
        
        const data: PostRead[] = await response.json(); // Tell TypeScript the incoming data shape
        setPosts(data);

      } catch (error) {
        console.error("Error fetching feed:", error instanceof Error ? error.message : error);
        Alert.alert("Error", "Could not fetch your feed. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeed();
  }, []); // Empty dependency array means this runs once on mount

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  // If there are no posts after loading
  if (posts.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyText}>No posts yet! Start following people or create your own.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.postContainer}>
            {/* Display username */}
            <Text style={styles.postUsername}>{item.user.username}</Text>
            
            {/* Display media_url if it exists */}
            {item.media_url && (
              <Image source={{ uri: item.media_url }} style={styles.postImage} />
            )}

            {/* Display post description */}
            <Text style={styles.postDescription}>{item.description}</Text>
          </View>
        )}
      />
    </View>
  );
}

// ====================================================================
//  Styles
// ====================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f9f9f9', // Light background
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  emptyContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#888',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  postContainer: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  postUsername: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    height: 200, // Fixed height for images
    borderRadius: 8,
    marginBottom: 10,
    resizeMode: 'cover', // Ensures image covers the area
  },
  postDescription: {
    fontSize: 14,
    color: '#666',
  },
});