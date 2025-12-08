import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, Image, StyleSheet, ActivityIndicator, 
  Pressable, Alert, ScrollView 
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

// Reuse types
type UserRead = { id: number; username: string; profile_pic?: string | null; };
type LikeRead = { user: UserRead; };
type CommentRead = { id: number; };
type PostRead = {
  id: number;
  description: string;
  media_url: string | null;
  user: UserRead;
  likes: LikeRead[];
  comments: CommentRead[];
};

export default function PostDetailsScreen() {
  const { postId } = useLocalSearchParams(); // Get ID from navigation
  const [post, setPost] = useState<PostRead | null>(null);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // --- Fetch Post & Current User ---
  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      // 1. Get Me (to check ownership and like status)
      const meRes = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      const meData = await meRes.json();
      setCurrentUserId(meData.id);

      // 2. Get Post
      const postRes = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (postRes.status === 404) {
        Alert.alert("Error", "Post not found");
        router.back();
        return;
      }
      
      const postData = await postRes.json();
      setPost(postData);

    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [postId, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Delete Logic ---
  // --- Delete Logic ---
  const handleDelete = async () => {
    Alert.alert(
      "Delete Post",
      "Are you sure? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
              });

              // FIX: Check if the server actually said "OK"
              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || "Server rejected delete");
              }

              // Only go back if it actually worked
              Alert.alert("Success", "Post deleted");
              router.back(); 

            } catch (e) {
              console.error("Delete failed:", e);
              Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete");
            }
          }
        }
      ]
    );
  };

  // --- Like Logic ---
  const toggleLike = async () => {
    if (!post || !currentUserId) return;
    try {
      const token = await AsyncStorage.getItem("token");
      await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${post.id}/like`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      fetchData(); // Refresh to see updated count
    } catch (e) {}
  };

  if (isLoading) return <ActivityIndicator style={styles.loader} size="large" color="#007AFF"/>;
  if (!post) return <View><Text>Post not found</Text></View>;

  const isOwner = currentUserId === post.user.id;
  const isLiked = post.likes.some(l => l.user.id === currentUserId);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={{paddingBottom: 40}}>
        
        {/* Header: User Info + Delete Button */}
        <View style={styles.header}>
          <View style={styles.userInfo}>
            {post.user.profile_pic ? (
              <Image source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${post.user.profile_pic}` }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.placeholder]}><Ionicons name="person" color="#888" /></View>
            )}
            <Text style={styles.username}>{post.user.username}</Text>
          </View>
          
          {/* Only show trash icon if I own the post */}
          {isOwner && (
            <Pressable onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#FF3B30" />
            </Pressable>
          )}
        </View>

        {/* Image */}
        {post.media_url && (
          <Image source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${post.media_url}` }} style={styles.image} />
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.actionItem}>
            <Pressable onPress={toggleLike}>
               <Ionicons name={isLiked ? "heart" : "heart-outline"} size={28} color={isLiked ? "red" : "#333"} />
            </Pressable>
            <Text style={styles.statText}>{post.likes.length} likes</Text>
          </View>
          
          <View style={styles.actionItem}>
            <Pressable onPress={() => router.push({ pathname: "/comments", params: { postId: post.id } })}>
               <Ionicons name="chatbubble-outline" size={26} color="#333" />
            </Pressable>
            <Text style={styles.statText}>{post.comments.length} comments</Text>
          </View>
        </View>

        {/* Caption */}
        <Text style={styles.caption}>
          <Text style={styles.username}>{post.user.username} </Text>
          {post.description}
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loader: { flex: 1, justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15 },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  placeholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  username: { fontWeight: 'bold', fontSize: 16 },
  image: { width: '100%', aspectRatio: 1, backgroundColor: '#f0f0f0' },
  actions: { flexDirection: 'row', padding: 15, paddingBottom: 10 },
  actionItem: { flexDirection: 'row', alignItems: 'center', marginRight: 20 },
  statText: { marginLeft: 5, fontWeight: '600' },
  caption: { paddingHorizontal: 15, lineHeight: 22, fontSize: 15 },
});