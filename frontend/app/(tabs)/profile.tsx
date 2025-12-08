import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// ====================================================================
//  Types 📖
// ====================================================================

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

// ====================================================================
//  ProfileScreen Component 👤
// ====================================================================

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

      // 1. Get My ID (we need to know WHO we are first)
      const meResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (meResponse.status === 401) throw new Error("Session Expired");
      const meData = await meResponse.json();

      // 2. Get Full Profile with Stats
      const profileResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${meData.id}/profile`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const profileData = await profileResponse.json();
      setProfile(profileData);

      // 3. Get User's Posts for the Grid
      const postsResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${meData.id}/posts`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      const postsData = await postsResponse.json();
      setPosts(postsData);

    } catch (error) {
      console.error("Error loading profile:", error);
      if (error instanceof Error && error.message === "Session Expired") {
        await AsyncStorage.removeItem("token");
        router.replace("/(auth)/login");
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchProfileData();
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    router.replace("/(auth)/login");
  };

  // --- Render Header (Profile Info) ---
  // We render this as the "Header" of the FlatList so the whole page scrolls
  const renderProfileHeader = () => {
    if (!profile) return null;

    return (
      <View style={styles.headerContainer}>
        {/* Top Row: Pic + Stats */}
        <View style={styles.topRow}>
          {/* Profile Pic */}
          <View style={styles.avatarContainer}>
            {profile.profile_pic ? (
              <Image
                source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${profile.profile_pic}` }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color="#ccc" />
              </View>
            )}
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.posts_count}</Text>
              <Text style={styles.statLabel}>Posts</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.followers_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.bioContainer}>
          <Text style={styles.username}>{profile.username}</Text>
          {profile.location && <Text style={styles.location}>📍 {profile.location}</Text>}
          {profile.bio ? (
            <Text style={styles.bio}>{profile.bio}</Text>
          ) : (
            <Text style={styles.bioPlaceholder}>No bio yet.</Text>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonRow}>

          <Pressable
            style={styles.editButton}
            onPress={() => router.push("/edit-profile")} // <-- Change this line
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </Pressable>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Grid Divider */}
        <View style={styles.divider} />
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // --- Main Render ---
  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id.toString()}
        numColumns={COLUMN_COUNT}
        ListHeaderComponent={renderProfileHeader}
        refreshing={isRefreshing}
        onRefresh={onRefresh}
        renderItem={({ item }) => (
          <View style={styles.gridItemContainer}>
            {item.media_url ? (
              <Image
                source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${item.media_url}` }}
                style={styles.gridImage}
              />
            ) : (
              <View style={[styles.gridImage, styles.gridPlaceholder]}>
                <Text style={styles.gridPlaceholderText}>{item.description.substring(0, 10)}...</Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text>No posts yet.</Text>
          </View>
        }
      />
    </View>
  );
}

// ====================================================================
//  Styles 🎨
// ====================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // --- Header Styles ---
  headerContainer: {
    padding: 15,
    paddingBottom: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarContainer: {
    marginRight: 20,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  statsContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  bioContainer: {
    marginBottom: 15,
  },
  username: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  location: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  bio: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bioPlaceholder: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  buttonRow: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#e1e1e1',
  },
  editButtonText: {
    fontWeight: '600',
    color: '#000',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 15,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: '#e1e1e1',
    marginHorizontal: -15, // Stretch full width
  },
  // --- Grid Styles ---
  gridItemContainer: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderWidth: 0.5,
    borderColor: '#fff', // Small gap between images
  },
  gridImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridPlaceholder: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  gridPlaceholderText: {
    fontSize: 10,
    color: '#888',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
});