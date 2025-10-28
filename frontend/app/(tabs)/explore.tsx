import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

// ====================================================================
//  TypeScript Type Definitions
// ====================================================================

// Basic User Info returned by search
type UserReadBasic = {
  id: number;
  username: string;
};

// User Info from /users/me (Currently doesn't include 'following' from backend)
type CurrentUserRead = UserReadBasic & {
  // We add 'following' here optimistically for the frontend state,
  // but the backend needs to be updated to actually send this list.
  following?: UserReadBasic[]; // Make following optional to handle missing data
  location?: string | null;
};

// ====================================================================
//  ExploreScreen Component (User Search Focused) 🧭
// ====================================================================

export default function ExploreScreen() {
  // --- State Variables ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserReadBasic[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUserRead | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const router = useRouter();

  // --- Check if Current User is Following Someone ---
  const isFollowing = useCallback((userId: number): boolean => {
    // Safely check if currentUser and currentUser.following exist before calling .some()
    return !!currentUser?.following?.some(followedUser => followedUser.id === userId);
  }, [currentUser]);

  // --- Fetch Current User Data ---
  const fetchCurrentUser = useCallback(async () => {
    if (currentUser) return; // Only fetch once initially

    let token: string | null = null;
    try {
      token = await AsyncStorage.getItem("token");
      if (!token) { router.replace("/(auth)/login"); return; }

      const userResponse = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      if (userResponse.status === 401) throw new Error("Session Expired");
      if (!userResponse.ok) throw new Error("Failed to fetch user details");

      // Assume backend *might* not send 'following', so initialize it if missing
      const userData: CurrentUserRead = await userResponse.json();
      setCurrentUser({ ...userData, following: userData.following || [] }); // Default to empty array if missing

    } catch (error) {
      console.error("Error fetching current user:", error instanceof Error ? error.message : error);
      if (error instanceof Error && error.message === "Session Expired") {
         Alert.alert("Session Expired", "Please log in again.");
         await AsyncStorage.removeItem("token");
         router.replace("/(auth)/login");
      }
      // Don't alert general errors here
    }
  }, [currentUser, router]); // Dependency on currentUser prevents re-fetch unless null

  // --- Fetch current user details on initial load ---
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  // --- Debounced User Search (Minimum 1 character) ---
  useEffect(() => {
    // Clear results immediately if query is empty
    if (searchQuery.trim().length === 0) {
      setSearchResults([]);
      setIsLoadingSearch(false);
      return;
    }
    // Start loading only if query length is sufficient (now >= 1)
     if (searchQuery.trim().length >= 1) {
       setIsLoadingSearch(true);
       const timerId = setTimeout(() => {
         handleUserSearch(searchQuery);
       }, 300); // 300ms debounce

       return () => clearTimeout(timerId); // Cleanup timer
     } else {
         // If query is present but too short (e.g., whitespace only), clear results & stop loading
         setSearchResults([]);
         setIsLoadingSearch(false);
     }
  }, [searchQuery]); // Re-run when searchQuery changes

  // --- Function to Fetch User Search Results ---
  const handleUserSearch = useCallback(async (query: string) => {
    let token: string | null = null;
    try {
      token = await AsyncStorage.getItem("token");
      if (!token) { router.replace("/(auth)/login"); return; }

      const encodedQuery = encodeURIComponent(query);
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/search?query=${encodedQuery}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.status === 401) throw new Error("Session Expired");
      if (!response.ok) {
         const errorData = await response.json();
         throw new Error(errorData.detail || `Search failed`);
      }

      const data: UserReadBasic[] = await response.json();
      setSearchResults(data);

    } catch (error) {
      console.error("Error searching users:", error instanceof Error ? error.message : error);
        if (error instanceof Error && error.message === "Session Expired") {
          Alert.alert("Session Expired", "Please log in again.");
          await AsyncStorage.removeItem("token");
          router.replace("/(auth)/login");
        } else {
           Alert.alert("Search Error", "Could not fetch search results.");
        }
        setSearchResults([]);
    } finally {
      setIsLoadingSearch(false);
    }
  }, [router]);

   // --- Function to Handle Follow/Unfollow ---
   const handleFollowToggle = useCallback(async (userIdToToggle: number) => {
     if (!currentUser) {
         Alert.alert("Error", "User data not loaded yet.");
         return;
     }

     const currentlyFollowing = isFollowing(userIdToToggle);
     const method = currentlyFollowing ? 'DELETE' : 'POST';
     const actionText = currentlyFollowing ? 'unfollow' : 'follow';

     // --- Optimistic UI Update ---
     // Store previous state in case we need to revert
     const previousUser = currentUser;
     setCurrentUser(prevUser => {
       if (!prevUser) return null;
       if (currentlyFollowing) {
         // Optimistically remove user from following list
         return { ...prevUser, following: (prevUser.following || []).filter(u => u.id !== userIdToToggle) };
       } else {
         // Optimistically add user to following list
         const userToFollow = searchResults.find(u => u.id === userIdToToggle);
         const newUserToFollow = userToFollow ? { id: userToFollow.id, username: userToFollow.username } : { id: userIdToToggle, username: '...' };
         return { ...prevUser, following: [...(prevUser.following || []), newUserToFollow] };
       }
     });
     // --- End Optimistic Update ---

     try {
       const token = await AsyncStorage.getItem("token");
       if (!token) { router.replace("/(auth)/login"); throw new Error("No token found"); } // Throw to trigger revert

       const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/${userIdToToggle}/follow`, {
         method: method,
         headers: { 'Authorization': `Bearer ${token}` },
       });

       if (response.status === 401) throw new Error("Session Expired");
       // Allow 404 on DELETE, treat other errors as failures
       if (!response.ok && !(method === 'DELETE' && response.status === 404)) {
            const errorData = await response.json();
            throw new Error(errorData.detail || `Failed to ${actionText}`);
       }
       // Success! Optimistic update stands. Optionally refetch for full consistency.
       // await fetchCurrentUser(); // Uncomment to refetch user data after successful action


     } catch (error) {
        console.error(`Error ${actionText}ing user:`, error instanceof Error ? error.message : error);
        // --- Revert Optimistic Update on Failure ---
        setCurrentUser(previousUser);
        // --- End Revert ---

        if (error instanceof Error && error.message === "Session Expired") {
          Alert.alert("Session Expired", "Please log in again.");
          await AsyncStorage.removeItem("token");
          router.replace("/(auth)/login");
        } else {
           Alert.alert("Error", `Could not ${actionText} user. ${error instanceof Error ? error.message : ''}`);
        }
     }
   }, [currentUser, router, isFollowing, fetchCurrentUser, searchResults]); // Added fetchCurrentUser for revert


  // --- Render Function for User List Item ---
  const renderUserItem = ({ item }: { item: UserReadBasic }) => {
     const currentlyFollowing = isFollowing(item.id);

     // Don't show the current user in search results
     if (currentUser?.id === item.id) {
       return null;
     }

     return (
        <View style={styles.resultItem}>
           <Text style={styles.username}>{item.username}</Text>
           {/* Follow/Unfollow Button */}
           <Pressable
              onPress={() => handleFollowToggle(item.id)}
              style={[styles.followButtonList, currentlyFollowing ? styles.followingButtonList : {}]}
              disabled={!currentUser} // Disable if currentUser data isn't loaded
           >
              <Text style={[styles.followButtonTextList, currentlyFollowing ? styles.followingButtonTextList : {}]}>
                 {currentlyFollowing ? 'Following' : 'Follow'}
              </Text>
           </Pressable>
        </View>
     );
  };

  // --- Main Return ---
  return (
    <View style={styles.container}>
      {/* Search Input */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search for users..."
        value={searchQuery}
        onChangeText={setSearchQuery} // Triggers debounced search
        returnKeyType="search"
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      {/* Loading Indicator for Search */}
      {isLoadingSearch && <ActivityIndicator style={styles.loadingIndicator} size="large" />}

      {/* User Search Results List */}
      <FlatList
        data={searchResults}
        renderItem={renderUserItem}
        keyExtractor={(item) => item.id.toString()}
        ListEmptyComponent={
          // Show message only when not loading and query has at least 1 char
          !isLoadingSearch && searchQuery.trim().length >= 1 ? (
            <Text style={styles.noResultsText}>No users found for "{searchQuery}"</Text>
          ) : null // Don't show anything if query is empty or loading
        }
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
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  searchInput: {
    height: 44,
    borderColor: '#e0e0e0',
    borderWidth: 1,
    borderRadius: 8,
    paddingLeft: 12,
    marginHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f9f9f9'
  },
  loadingIndicator: {
    marginVertical: 30,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  username: {
    fontSize: 16,
    fontWeight: '500',
  },
  followButtonList: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: 'transparent',
  },
  followingButtonList: {
      backgroundColor: '#007AFF', // Filled blue when following
  },
  followButtonTextList: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 13,
  },
  followingButtonTextList: {
      color: '#fff', // White text when following
  },
  noResultsText: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
    color: '#888',
  },
});