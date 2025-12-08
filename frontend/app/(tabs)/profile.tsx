import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

type UserProfile = {
  id: number;
  username: string;
  location?: string | null;
  bio?: string | null;
  profile_pic?: string | null;
  followers_count: number;
  following_count: number;
  posts_count: number;
};

type PostGridItem = {
  id: number;
  media_url: string | null;
  description: string;
};

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = width / COLUMN_COUNT;

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostGridItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const router = useRouter();

  const fetchProfileData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) { router.replace("/(auth)/login"); return; }

      // 1. Get Me
      const meResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (meResponse.status === 401) throw new Error("Session Expired");
      const meData = await meResponse.json();

      // 2. Get Profile Stats
      const profileResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${meData.id}/profile`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      setProfile(await profileResponse.json());

      // 3. Get Posts
      const postsResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${meData.id}/posts`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      setPosts(await postsResponse.json());

    } catch (error) {
      if (error instanceof Error && error.message === "Session Expired") {
        await AsyncStorage.removeItem("token");
        router.replace("/(auth)/login");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { fetchProfileData(); }, [fetchProfileData]));

  const onRefresh = () => { setIsRefreshing(true); fetchProfileData(); };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    setProfile(null);
    setPosts([]);
    router.replace("/(auth)/login");
  };

  const renderHeader = () => {
    if (!profile) return null;
    return (
      <View style={styles.headerContainer}>
        {/* Blue Header Title */}
        <Text style={styles.headerTitle}>Profile</Text>

        <View style={styles.topRow}>
          {profile.profile_pic ? (
            <Image 
              source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${profile.profile_pic}` }} 
              style={styles.avatar} 
            />
          ) : (
            <View style={[styles.avatar, styles.placeholder]}>
              <Ionicons name="person" size={40} color="#ccc" />
            </View>
          )}

          <View style={styles.stats}>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{profile.posts_count}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{profile.followers_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNum}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        <Text style={styles.name}>{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={styles.btnRow}>
          <Pressable style={styles.editBtn} onPress={() => router.push("/edit-profile")}>
            <Text style={styles.editBtnText}>Edit Profile</Text>
          </Pressable>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    );
  };

  if (isLoading && !profile) {
    return <View style={styles.loaderContainer}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        data={posts}
        keyExtractor={item => item.id.toString()}
        numColumns={COLUMN_COUNT}
        ListHeaderComponent={renderHeader}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="images-outline" size={50} color="#ccc" />
            <Text style={styles.emptyText}>No posts yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          // UPDATED: Pressable wraps the image to navigate to details
          <Pressable 
            style={styles.gridItem}
            onPress={() => router.push({ pathname: "/post-details", params: { postId: item.id } })}
          >
             {item.media_url ? (
                <Image source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${item.media_url}` }} style={styles.gridImage} />
             ) : (
                <View style={[styles.gridImage, styles.gridTextPlaceholder]}>
                    <Text style={{fontSize:10, color:'#888'}}>{item.description.substring(0,10)}...</Text>
                </View>
             )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerContainer: { padding: 15, paddingBottom: 20 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#007AFF' },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginRight: 20 },
  placeholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statBox: { alignItems: 'center' },
  statNum: { fontSize: 18, fontWeight: 'bold', color: '#000' },
  statLabel: { fontSize: 13, color: '#666' },
  name: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  bio: { marginTop: 4, color: '#333', lineHeight: 20 },
  btnRow: { flexDirection: 'row', marginTop: 20 },
  editBtn: { flex: 1, backgroundColor: '#f0f0f0', paddingVertical: 8, borderRadius: 6, alignItems: 'center', marginRight: 10, borderWidth: 1, borderColor: '#ddd' },
  editBtnText: { fontWeight: '600', color: '#000' },
  logoutBtn: { backgroundColor: '#FF3B30', paddingHorizontal: 15, justifyContent: 'center', alignItems: 'center', borderRadius: 6 },
  gridItem: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderWidth: 0.5, borderColor: '#fff' },
  gridImage: { width: '100%', height: '100%' },
  gridTextPlaceholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { marginTop: 10, color: '#888', fontSize: 16 },
});
