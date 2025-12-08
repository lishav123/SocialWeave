import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, FlatList, ActivityIndicator, Dimensions, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

type UserProfile = { id: number; username: string; bio?: string; profile_pic?: string; followers_count: number; following_count: number; posts_count: number; };
type PostGridItem = { id: number; media_url: string; };
type UserReadBasic = { id: number; username: string; };
type CurrentUser = { id: number; following: UserReadBasic[] }; 

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const IMAGE_SIZE = width / COLUMN_COUNT;

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams();
  const targetUserId = Number(Array.isArray(userId) ? userId[0] : userId);
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<PostGridItem[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if(!token) return;

      const meRes = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, { headers: { "Authorization": `Bearer ${token}` } });
      const meData = await meRes.json();
      setCurrentUser({ ...meData, following: meData.following || [] });

      const [pRes, postRes] = await Promise.all([
          fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${targetUserId}/profile`, { headers: { "Authorization": `Bearer ${token}` } }),
          fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${targetUserId}/posts`, { headers: { "Authorization": `Bearer ${token}` } })
      ]);
      setProfile(await pRes.json());
      setPosts(await postRes.json());

    } catch (e) { console.error(e); } 
    finally { setIsLoading(false); }
  }, [targetUserId]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const isFollowing = currentUser?.following?.some(u => u.id === targetUserId);

  const handleFollowToggle = async () => {
    if (!currentUser || !profile) return;
    
    const currentlyFollowing = !!isFollowing; 
    const method = currentlyFollowing ? 'DELETE' : 'POST';

    // Optimistic Update
    const oldCurrentUser = { ...currentUser };
    const oldProfile = { ...profile };

    setCurrentUser(prev => {
        if(!prev) return null;
        if(currentlyFollowing) {
            return { ...prev, following: prev.following.filter(u => u.id !== targetUserId) };
        } else {
            return { ...prev, following: [...prev.following, { id: targetUserId, username: profile.username }] };
        }
    });

    setProfile(prev => prev ? ({ ...prev, followers_count: prev.followers_count + (currentlyFollowing ? -1 : 1) }) : null);

    try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${targetUserId}/follow`, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` },
        });
        
        if (!res.ok && !(method === 'DELETE' && res.status === 404)) {
            throw new Error(`Failed with status ${res.status}`);
        }
    } catch(e) {
        Alert.alert("Error", "Could not update follow status.");
        setCurrentUser(oldCurrentUser);
        setProfile(oldProfile);
    }
  };

  if (isLoading) return <ActivityIndicator style={{marginTop: 50}} size="large" color="#007AFF" />;
  if (!profile) return <View><Text>User not found</Text></View>;

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.topRow}>
        {profile.profile_pic ? (
          <Image source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${profile.profile_pic}` }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholder]}><Ionicons name="person" size={40} color="#ccc" /></View>
        )}
        <View style={styles.stats}>
          <View style={styles.statItem}><Text style={styles.statNum}>{profile.posts_count}</Text><Text style={styles.statLabel}>Posts</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>{profile.followers_count}</Text><Text style={styles.statLabel}>Followers</Text></View>
          <View style={styles.statItem}><Text style={styles.statNum}>{profile.following_count}</Text><Text style={styles.statLabel}>Following</Text></View>
        </View>
      </View>
      <Text style={styles.username}>{profile.username}</Text>
      {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

      {currentUser?.id !== profile.id && (
          <Pressable 
            style={[styles.followBtn, isFollowing ? styles.followingBtn : {}]} 
            onPress={handleFollowToggle}
          >
              <Text style={[styles.followText, isFollowing ? styles.followingText : {}]}>
                  {isFollowing ? 'Following' : 'Follow'}
              </Text>
          </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        numColumns={COLUMN_COUNT}
        ListHeaderComponent={renderHeader}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          // UPDATED: Pressable wraps the image to navigate to details
          <Pressable 
            style={styles.gridItem}
            onPress={() => router.push({ pathname: "/post-details", params: { postId: item.id } })}
          >
             {item.media_url ? (
                <Image source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${item.media_url}` }} style={styles.image} />
             ) : (
                <View style={[styles.image, {backgroundColor:'#eee'}]} />
             )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 15 },
  topRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginRight: 20 },
  placeholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', marginRight: 20, width: 80, height: 80, borderRadius: 40 },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNum: { fontWeight: 'bold', fontSize: 18 },
  statLabel: { color: '#666', fontSize: 12 },
  username: { fontWeight: 'bold', fontSize: 16 },
  bio: { marginTop: 5, color: '#333' },
  followBtn: { marginTop: 15, backgroundColor: '#007AFF', paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  followingBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd' },
  followText: { color: '#fff', fontWeight: '600' },
  followingText: { color: '#333' },
  gridItem: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderWidth: 0.5, borderColor: '#fff' },
  image: { width: '100%', height: '100%' },
});