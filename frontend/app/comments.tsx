import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams();
  const [comments, setComments] = useState<any[]>([]); // Use proper type in real app
  const [newComment, setNewComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchComments = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      // Fetch the single post to get updated comments
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const data = await response.json();
      setComments(data.comments.reverse()); // Show newest at bottom usually, or top
    } catch (e) { console.error(e); } 
    finally { setIsLoading(false); }
  };

  useEffect(() => { if(postId) fetchComments(); }, [postId]);

  const handleSubmit = async () => {
    if (!newComment.trim()) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: newComment }),
      });
      if (response.ok) {
        setNewComment("");
        fetchComments(); // Refresh list
      }
    } catch (e) { console.error(e); }
  };

  const navigateToProfile = (userId: number) => {
      router.push({ pathname: "/user-profile", params: { userId } });
  };

  if (isLoading) return <ActivityIndicator style={{marginTop: 20}} />;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container} keyboardVerticalOffset={80}>
      <FlatList
        data={comments}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.commentItem}>
            <Pressable onPress={() => navigateToProfile(item.user.id)}>
                {item.user.profile_pic ? (
                    <Image source={{uri: `${process.env.EXPO_PUBLIC_API_URL}${item.user.profile_pic}`}} style={styles.avatar}/>
                ) : (
                    <View style={[styles.avatar, styles.placeholder]}><Ionicons name="person" color="#ccc" /></View>
                )}
            </Pressable>
            <View style={styles.commentContent}>
                <Text style={styles.username} onPress={() => navigateToProfile(item.user.id)}>
                    {item.user.username}
                </Text>
                <Text>{item.text}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.inputContainer}>
        <TextInput style={styles.input} placeholder="Add a comment..." value={newComment} onChangeText={setNewComment} />
        <Pressable onPress={handleSubmit}><Text style={styles.postBtn}>Post</Text></Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  commentItem: { flexDirection: 'row', padding: 15, borderBottomWidth: 1, borderColor: '#eee' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
  placeholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  commentContent: { flex: 1, justifyContent: 'center' },
  username: { fontWeight: 'bold', marginBottom: 2 },
  inputContainer: { flexDirection: 'row', padding: 15, borderTopWidth: 1, borderColor: '#eee', alignItems: 'center' },
  input: { flex: 1, height: 40, borderWidth: 1, borderColor: '#ddd', borderRadius: 20, paddingHorizontal: 15, marginRight: 10 },
  postBtn: { color: '#007AFF', fontWeight: 'bold' },
});