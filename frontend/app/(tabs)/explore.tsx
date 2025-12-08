import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, FlatList, Pressable,
  ActivityIndicator, Image, Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type UserReadBasic = { id: number; username: string; profile_pic?: string | null; };
type CurrentUserRead = UserReadBasic & { following: UserReadBasic[]; }; // Made following required

export default function ExploreScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserReadBasic[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserRead | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  
  const router = useRouter();

  // 1. Fetch Me & My Following List
  const fetchCurrentUser = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) { router.replace("/(auth)/login"); return; }
      
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      
      if (res.ok) {
        const data = await res.json();
        // Backend now sends 'following', so we use it directly
        setCurrentUser(data);
      }
    } catch (error) { console.log(error); }
  }, [router]);

  // Refresh whenever screen focuses
  useFocusEffect(useCallback(() => { fetchCurrentUser(); }, [fetchCurrentUser]));

  // Check Helper
  const isFollowing = (userId: number) => {
    return !!currentUser?.following?.some(u => u.id === userId);
  };

  // 2. Search
  useEffect(() => {
    if (searchQuery.trim().length === 0) { setSearchResults([]); setIsLoadingSearch(false); return; }
    setIsLoadingSearch(true);
    const timer = setTimeout(async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/search?query=${encodeURIComponent(searchQuery)}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) setSearchResults(await res.json());
      } catch (e) {} finally { setIsLoadingSearch(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 3. Toggle Follow
  const handleFollowToggle = async (userId: number) => {
    if (!currentUser) return;
    const currentlyFollowing = isFollowing(userId);
    
    // Optimistic Update
    const previousUser = { ...currentUser };
    setCurrentUser(prev => {
      if(!prev) return null;
      if (currentlyFollowing) {
        return { ...prev, following: prev.following.filter(u => u.id !== userId) };
      } else {
        return { ...prev, following: [...prev.following, { id: userId, username: '...', profile_pic: null }] };
      }
    });

    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${userId}/follow`, {
        method: currentlyFollowing ? 'DELETE' : 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 404) throw new Error("Failed");
    } catch (e) {
      setCurrentUser(previousUser); // Revert
      Alert.alert("Error", "Action failed");
    }
  };

  const goToProfile = (userId: number) => router.push({ pathname: "/user-profile", params: { userId } });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <Text style={styles.headerTitle}>Explore</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          placeholderTextColor="#888"
        />

        {isLoadingSearch && <ActivityIndicator style={{ marginTop: 20 }} color="#007AFF" />}

        <FlatList
          data={searchResults}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) => {
            if (currentUser?.id === item.id) return null;
            const following = isFollowing(item.id);

            return (
              <Pressable style={styles.userRow} onPress={() => goToProfile(item.id)}>
                <View style={styles.userInfo}>
                  {item.profile_pic ? (
                    <Image source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${item.profile_pic}` }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}><Ionicons name="person" size={20} color="#888" /></View>
                  )}
                  <Text style={styles.username}>{item.username}</Text>
                </View>

                <Pressable
                  style={[styles.btn, following ? styles.btnFollowing : styles.btnFollow]}
                  onPress={(e) => { e.stopPropagation(); handleFollowToggle(item.id); }}
                >
                  <Text style={following ? styles.txtFollowing : styles.txtFollow}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, paddingHorizontal: 15, paddingTop: 10 },
  headerTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 15, color: '#007AFF' },
  searchInput: { height: 44, backgroundColor: '#f0f2f5', borderRadius: 8, paddingHorizontal: 15, fontSize: 16 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#eee' },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  username: { fontSize: 16, fontWeight: '500' },
  btn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6, borderWidth: 1 },
  btnFollow: { borderColor: '#007AFF', backgroundColor: '#fff' },
  btnFollowing: { borderColor: '#007AFF', backgroundColor: '#007AFF' },
  txtFollow: { color: '#007AFF', fontWeight: '600', fontSize: 13 },
  txtFollowing: { color: '#fff', fontWeight: '600', fontSize: 13 },
});