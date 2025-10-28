import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  Image,
  ActivityIndicator,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

type UserRead = {
  id: number;
  username: string;
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

export default function FeedScreen() {
  const [posts, setPosts] = useState<PostRead[]>([]);
  const [currentUser, setCurrentUser] = useState<UserRead | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [commentingPostId, setCommentingPostId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');

  const router = useRouter();

  const fetchFeedData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setIsLoading(true);
    let token: string | null = null;

    try {
      token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      if (!currentUser || isRefresh) {
        const userResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (userResponse.status === 401) throw new Error("Session Expired");
        if (!userResponse.ok) throw new Error("Failed to fetch user details");
        const userData: UserRead = await userResponse.json();
        setCurrentUser(userData);
      }

      const feedResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/feed`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (feedResponse.status === 401) throw new Error("Session Expired");
      if (!feedResponse.ok) throw new Error("Failed to fetch feed");
      const feedData: PostRead[] = await feedResponse.json();
      setPosts(feedData);
    } catch (error) {
      console.error("Error fetching data:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.message === "Session Expired") {
        Alert.alert("Session Expired", "Please log in again.");
        await AsyncStorage.removeItem("token");
        router.replace("/(auth)/login");
      } else if (!isRefresh) {
        Alert.alert("Error", "Could not load feed.");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [currentUser, router]);

  useEffect(() => {
    fetchFeedData();
  }, [fetchFeedData]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchFeedData(true);
  }, [fetchFeedData]);

  const toggleLike = useCallback(async (postId: number) => {
    if (!currentUser) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) throw new Error("Session Expired");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to toggle like");
      }

      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === postId) {
            const alreadyLiked = post.likes.some(like => like.user.id === currentUser.id);
            if (alreadyLiked) {
              return { ...post, likes: post.likes.filter(like => like.user.id !== currentUser.id) };
            } else {
              return { ...post, likes: [...post.likes, { user: currentUser }] };
            }
          }
          return post;
        })
      );
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
  }, [currentUser, router]);

  const handleCommentSubmit = useCallback(async () => {
    if (!commentingPostId || !commentText.trim() || !currentUser) return;

    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${commentingPostId}/comments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: commentText }),
      });

      if (response.status === 401) throw new Error("Session Expired");
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to post comment");
      }

      const newComment: CommentRead = await response.json();

      setPosts(currentPosts =>
        currentPosts.map(post => {
          if (post.id === commentingPostId) {
            return { ...post, comments: [newComment, ...post.comments] };
          }
          return post;
        })
      );

      setCommentText('');
      setCommentingPostId(null);
    } catch (error) {
      console.error("Error posting comment:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.message === "Session Expired") {
        Alert.alert("Session Expired", "Please log in again.");
        await AsyncStorage.removeItem("token");
        router.replace("/(auth)/login");
      } else {
        Alert.alert("Error", "Could not post comment.");
      }
    }
  }, [commentingPostId, commentText, currentUser, router]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading feed...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => {
          const isLikedByCurrentUser =
            !!currentUser && item.likes.some(like => like.user.id === currentUser.id);
          const showCommentInput = commentingPostId === item.id;

          return (
            <View style={styles.postContainer}>
              <View style={styles.postHeader}>
                <Text style={styles.postUsername}>{item.user.username}</Text>
              </View>

              {item.media_url && (
                <Image
                  source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${item.media_url}` }}
                  style={styles.postImage}
                />
              )}

              <Text style={styles.postDescription}>{item.description}</Text>

              <View style={styles.actionsContainer}>
                <Pressable onPress={() => toggleLike(item.id)} style={styles.actionButton}>
                  <Ionicons
                    name={isLikedByCurrentUser ? "heart" : "heart-outline"}
                    size={26}
                    color={isLikedByCurrentUser ? "red" : "#333"}
                  />
                </Pressable>

                <Pressable
                  onPress={() => setCommentingPostId(item.id)}
                  style={styles.actionButton}
                >
                  <Ionicons name="chatbubble-outline" size={24} color="#333" />
                </Pressable>

                <View style={{ flex: 1 }} />

                {item.likes.length > 0 && (
                  <Text style={styles.likeCount}>
                    {item.likes.length} like{item.likes.length !== 1 ? 's' : ''}
                  </Text>
                )}
              </View>

              <View style={styles.commentsPreview}>
                {item.comments.slice(0, 2).map(comment => (
                  <Text key={comment.id} style={styles.commentText} numberOfLines={2}>
                    <Text style={styles.commentUsername}>{comment.user.username}: </Text>
                    {comment.text}
                  </Text>
                ))}

                {item.comments.length > 2 && (
                  <Pressable>
                    <Text style={styles.viewMoreComments}>
                      View all {item.comments.length} comments
                    </Text>
                  </Pressable>
                )}
              </View>

              {showCommentInput && (
                <View style={styles.commentInputContainer}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment..."
                    value={commentText}
                    onChangeText={setCommentText}
                    autoFocus={true}
                    onSubmitEditing={handleCommentSubmit}
                  />
                  <Pressable onPress={handleCommentSubmit} disabled={!commentText.trim()}>
                    <Text
                      style={[
                        styles.postButton,
                        !commentText.trim() && styles.postButtonDisabled,
                      ]}
                    >
                      Post
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        ListEmptyComponent={
          !isLoading && posts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Your feed is empty. Follow users or create posts!
              </Text>
            </View>
          ) : null
        }
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
  },
  loadingText: { marginTop: 10, fontSize: 16, color: '#555' },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 300,
  },
  emptyText: { fontSize: 18, color: '#657786', textAlign: 'center' },
  postContainer: {
    backgroundColor: '#fff',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e8ed',
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  postUsername: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#14171a',
  },
  postImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#e1e8ed',
  },
  postDescription: {
    fontSize: 14,
    color: '#14171a',
    lineHeight: 20,
    paddingHorizontal: 15,
    marginTop: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 12,
    paddingVertical: 4,
  },
  actionButton: {
    padding: 8,
  },
  likeCount: {
    fontSize: 14,
    color: '#657786',
    fontWeight: '600',
    marginLeft: 6,
  },
  commentsPreview: {
    paddingHorizontal: 15,
    marginTop: 6,
    paddingBottom: 10,
  },
  commentText: {
    fontSize: 14,
    color: '#14171a',
    marginBottom: 3,
    lineHeight: 18,
  },
  commentUsername: {
    fontWeight: '600',
  },
  viewMoreComments: {
    color: '#657786',
    fontSize: 14,
    marginTop: 6,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#e1e8ed',
    backgroundColor: '#fff',
  },
  commentInput: {
    flex: 1,
    height: 40,
    borderColor: '#e1e8ed',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    marginRight: 10,
    backgroundColor: '#f5f8fa',
  },
  postButton: {
    color: '#1DA1F2',
    fontWeight: '600',
    fontSize: 16,
  },
  postButtonDisabled: {
    color: '#aab8c2',
  },
});
