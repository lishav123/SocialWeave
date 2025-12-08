import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// FIX: Import SafeAreaView from the correct library to handle notches/status bars
import { SafeAreaView } from 'react-native-safe-area-context';

// ====================================================================
//  Type Definitions
// ====================================================================

type UserRead = {
  id: number;
  username: string;
  profile_pic?: string | null;
  location?: string | null;
};

type LikeRead = {
  user: UserRead;
};

type CommentRead = {
  id: number;
  text: string;
  user: UserRead;
};

type PostRead = {
  id: number;
  description: string;
  media_url: string | null;
  user: UserRead;
  likes: LikeRead[];
  comments: CommentRead[];
};

// ====================================================================
//  FeedScreen Component
// ====================================================================

export default function FeedScreen() {
  const [posts, setPosts] = useState<PostRead[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const router = useRouter();

  // --- Data Fetching Logic ---
  const fetchFeedData = useCallback(async (isRefresh = false) => {
    // Only show full loading screen on initial load if we have no posts
    if (!isRefresh && posts.length === 0) setIsLoading(true);
    
    let token: string | null = null;

    try {
      token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      // 1. Fetch Current User (to check if we liked posts & update profile pic)
      const userResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (userResponse.status === 401) throw new Error("Session Expired");
      const userData: UserRead = await userResponse.json();
      setCurrentUser(userData);

      // 2. Fetch Feed Posts
      const feedResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/feed`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (feedResponse.status === 401) throw new Error("Session Expired");
      
      const feedData: PostRead[] = await feedResponse.json();
      setPosts(feedData);

    } catch (error) {
      console.error("Error fetching data:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.message === "Session Expired") {
        await AsyncStorage.removeItem("token");
        router.replace("/(auth)/login");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  // --- Refresh when screen comes into focus ---
  useFocusEffect(
    useCallback(() => {
      fetchFeedData();
    }, [fetchFeedData])
  );

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchFeedData(true);
  }, [fetchFeedData]);

  // --- Like Logic ---
  const toggleLike = useCallback(async (postId: number) => {
    if (!currentUser) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) { router.replace("/(auth)/login"); return; }

      // Optimistic UI Update
      setPosts(currentPosts => currentPosts.map(post => {
        if (post.id === postId) {
          const alreadyLiked = post.likes.some(like => like.user.id === currentUser.id);
          if (alreadyLiked) {
            return { ...post, likes: post.likes.filter(like => like.user.id !== currentUser.id) };
          } else {
            return { ...post, likes: [...post.likes, { user: currentUser }] };
          }
        }
        return post;
      }));

      // API Call
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
      });

      if (response.status === 401) throw new Error("Session Expired");
      // Optional: Refetch specific post to ensure sync

    } catch (error) {
      console.error("Error toggling like:", error);
    }
  }, [currentUser, router]);

  // --- Navigation ---
  const goToProfile = (userId: number) => {
    if (currentUser?.id === userId) {
        router.push("/(tabs)/profile");
    } else {
        router.push({ pathname: "/user-profile", params: { userId } });
    }
  };

  const goToComments = (postId: number) => {
    router.push({ pathname: "/comments", params: { postId } });
  };

  // --- Render ---
  if (isLoading && posts.length === 0) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    // FIX: edges={['top']} ensures we only pad the top (Status Bar)
    // The bottom is handled by the Tab Bar + contentContainerStyle
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        
        {/* Header Title */}
        <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitleText}>SocialWeave</Text>
        </View>

        <FlatList
          data={posts}
          keyExtractor={(item) => item.id.toString()}
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          // FIX: Add padding at bottom so last post scrolls above tabs
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            !isLoading && posts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>Your feed is empty.</Text>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const isLikedByCurrentUser = !!currentUser && item.likes.some(like => like.user.id === currentUser.id);

            return (
              <View style={styles.postContainer}>
                
                {/* --- HEADER: User Info --- */}
                <View style={styles.postHeader}>
                  <Pressable onPress={() => goToProfile(item.user.id)} style={styles.userInfo}>
                      {item.user.profile_pic ? (
                          <Image 
                              source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${item.user.profile_pic}` }} 
                              style={styles.avatar} 
                          />
                      ) : (
                          <View style={[styles.avatar, styles.avatarPlaceholder]}>
                              <Ionicons name="person" size={18} color="#888" />
                          </View>
                      )}
                      <Text style={styles.postUsername}>{item.user.username}</Text>
                  </Pressable>
                </View>

                {/* --- IMAGE --- */}
                {item.media_url && (
                  <Image
                    source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${item.media_url}` }}
                    style={styles.postImage}
                  />
                )}

                {/* --- ACTIONS --- */}
                <View style={styles.actionsContainer}>
                  <View style={styles.actionItem}>
                      <Pressable onPress={() => toggleLike(item.id)}>
                      <Ionicons
                          name={isLikedByCurrentUser ? "heart" : "heart-outline"}
                          size={26}
                          color={isLikedByCurrentUser ? "red" : "#333"}
                      />
                      </Pressable>
                      {item.likes.length > 0 && (
                          <Text style={styles.countText}>{item.likes.length}</Text>
                      )}
                  </View>

                  <View style={styles.actionItem}>
                      <Pressable onPress={() => goToComments(item.id)}>
                      <Ionicons name="chatbubble-outline" size={24} color="#333" />
                      </Pressable>
                      {item.comments.length > 0 && (
                          <Text style={styles.countText}>{item.comments.length}</Text>
                      )}
                  </View>
                </View>

                {/* --- CAPTION --- */}
                <Text style={styles.postDescription}>
                  <Text style={styles.captionUsername} onPress={() => goToProfile(item.user.id)}>
                      {item.user.username}{' '}
                  </Text>
                  {item.description}
                </Text>

                {/* --- COMMENTS LINK --- */}
                {item.comments.length > 0 && (
                  <Pressable onPress={() => goToComments(item.id)}>
                      <Text style={styles.viewMoreComments}>
                          View all {item.comments.length} comments
                      </Text>
                  </Pressable>
                )}

              </View>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

// ====================================================================
//  Styles 🎨
// ====================================================================
const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#fff', // Match header color
    },
    container: {
        flex: 1,
        backgroundColor: '#f0f2f5',
    },
    headerTitleContainer: {
        backgroundColor: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#e1e8ed',
    },
    headerTitleText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#007AFF', // Brand color
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        minHeight: 300,
    },
    emptyText: { fontSize: 18, color: '#657786', textAlign: 'center' },
    
    // Post Card
    postContainer: {
        backgroundColor: '#fff',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e1e8ed',
        borderTopWidth: 1,
        borderTopColor: '#e1e8ed',
        paddingBottom: 10,
    },
    
    // Header
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 10,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        marginRight: 10,
    },
    avatarPlaceholder: {
        backgroundColor: '#eee',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    postUsername: {
        fontWeight: 'bold',
        fontSize: 15,
        color: '#14171a',
    },
    
    // Image
    postImage: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#eee',
    },
    
    // Actions
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginTop: 10,
    },
    actionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 20,
    },
    countText: {
        marginLeft: 6,
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
    },
    
    // Text
    postDescription: {
        paddingHorizontal: 10,
        marginTop: 8,
        fontSize: 14,
        color: '#14171a',
        lineHeight: 20,
    },
    captionUsername: {
        fontWeight: 'bold',
    },
    viewMoreComments: {
        paddingHorizontal: 10,
        marginTop: 6,
        color: '#657786',
        fontSize: 14,
    },
});