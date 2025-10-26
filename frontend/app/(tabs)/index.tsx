import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// ====================================================================
//  TypeScript Type Definitions
// ====================================================================

type UserRead = {
  id: number;
  username: string;
  location?: string | null;
};

type LikeRead = {
  user: UserRead;
};

// type CommentRead = { ... }; // Define later if needed

type PostRead = {
  id: number;
  description: string;
  media_url: string | null;
  user: UserRead;
  likes: LikeRead[];
  // comments: CommentRead[];
};

// ====================================================================
//  FeedScreen Component
// ====================================================================

export default function FeedScreen() {
  const [posts, setPosts] = useState<PostRead[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null); // State for logged-in user details
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initializeFeed = async () => {
      setIsLoading(true);
      let token: string | null = null; // Declare token here

      try {
        token = await AsyncStorage.getItem("token");

        if (!token) {
          router.replace("/(auth)/login");
          return;
        }

        // --- 1. Fetch Current User Details ---
        const userResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
          headers: { "Authorization": `Bearer ${token}` },
        });

        if (userResponse.status === 401) throw new Error("Session Expired");
        if (!userResponse.ok) throw new Error("Failed to fetch user details");

        const userData: UserRead = await userResponse.json();
        setCurrentUser(userData); // Save current user details

        // --- 2. Fetch Feed Posts ---
        const feedResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/feed`, {
          headers: { "Authorization": `Bearer ${token}` },
        });

        if (feedResponse.status === 401) throw new Error("Session Expired"); // Check again, just in case
        if (!feedResponse.ok) throw new Error("Failed to fetch feed");

        const feedData: PostRead[] = await feedResponse.json();
        setPosts(feedData);

      } catch (error) {
        console.error("Error initializing feed:", error instanceof Error ? error.message : error);
        if (error instanceof Error && error.message === "Session Expired") {
          Alert.alert("Session Expired", "Please log in again.");
          await AsyncStorage.removeItem("token");
          router.replace("/(auth)/login");
        } else {
          Alert.alert("Error", "Could not load feed.");
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeFeed();
  }, []); // Run once on mount

  // --- Handle Like/Unlike ---
  const toggleLike = async (postId: number) => {
     if (!currentUser) return; // Don't do anything if user isn't loaded yet

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (response.status === 401) throw new Error("Session Expired"); // Throw error to be caught below
      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.detail || `Failed to toggle like`);
      }

      // --- Update UI Immediately ---
      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === postId) {
          const alreadyLiked = post.likes.some(like => like.user.id === currentUser.id);
          if (alreadyLiked) {
            // Remove the like
            return {
              ...post,
              likes: post.likes.filter(like => like.user.id !== currentUser.id)
            };
          } else {
            // Add the like
            return {
              ...post,
              likes: [...post.likes, { user: currentUser }] // Use the fetched currentUser object
            };
          }
        }
        return post;
      }));

    } catch (error) {
       console.error("Error toggling like:", error instanceof Error ? error.message : error);
        if (error instanceof Error && error.message === "Session Expired") {
          Alert.alert("Session Expired", "Please log in again.");
          await AsyncStorage.removeItem("token");
          router.replace("/(auth)/login");
        } else {
           Alert.alert("Error", "Could not update like status.");
        }
    }
  };

  // --- Render UI ---
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  if (posts.length === 0) {
    return (
      <View style={[styles.container, styles.emptyContainer]}>
        <Text style={styles.emptyText}>Your feed is empty. Follow users or create posts!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          // Check if the current user (if loaded) has liked this specific post
          const isLikedByCurrentUser = !!currentUser && item.likes.some(like => like.user.id === currentUser.id);

          return (
            <View style={styles.postContainer}>
              <Text style={styles.postUsername}>{item.user.username}</Text>

              {item.media_url && (
                <Image source={{ uri: item.media_url }} style={styles.postImage} />
              )}

              <Text style={styles.postDescription}>{item.description}</Text>

              {/* Like Button & Count */}
              <View style={styles.actionsContainer}>
                <Pressable
                  onPress={() => toggleLike(item.id)}
                  style={styles.actionButton}
                  disabled={!currentUser} // Disable if currentUser isn't loaded yet
                 >
                  <Ionicons
                    name={isLikedByCurrentUser ? "heart" : "heart-outline"}
                    size={24}
                    color={isLikedByCurrentUser ? "red" : "black"}
                  />
                </Pressable>
                {item.likes.length > 0 && (
                   <Text style={styles.likeCount}>{item.likes.length} like{item.likes.length !== 1 ? 's' : ''}</Text>
                )}
                {/* Comment Button (add later) */}
              </View>

            </View>
          );
        }}
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
    paddingTop: 10, // Added padding top
    paddingHorizontal: 10, // Horizontal padding
    backgroundColor: '#f9f9f9',
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
    flex: 1, // Make it take full height
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
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  postUsername: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#eee',
  },
  postDescription: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    padding: 5, // Add padding to make icon easier to tap
    marginRight: 5, // Adjust spacing
  },
  likeCount: {
      fontSize: 14,
      color: '#555',
      fontWeight: '600',
  }
});