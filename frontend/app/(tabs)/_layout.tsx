import React, { useState, useCallback } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image, View, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Import the hook to handle safe areas correctly
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#007AFF';
const INACTIVE_COLOR = '#8E8E93';

export default function TabLayout() {
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const insets = useSafeAreaInsets(); // Get safe area insets (top, bottom, left, right)

  // Update profile pic whenever the tabs come into focus
  useFocusEffect(
    useCallback(() => {
      const fetchProfilePic = async () => {
        try {
          const token = await AsyncStorage.getItem("token");
          if (!token) return;

          const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/users/me`, {
            headers: { "Authorization": `Bearer ${token}` },
          });

          if (response.ok) {
            const data = await response.json();
            if (data.profile_pic) {
              setProfilePic(data.profile_pic);
            }
          }
        } catch (error) {
          // Silent fail is okay here
        }
      };
      fetchProfilePic();
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE_COLOR,
        tabBarInactiveTintColor: INACTIVE_COLOR,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#e5e5e5',
          // Dynamic Height: Base (60) + Bottom Safe Area
          height: 60 + insets.bottom,
          // Dynamic Padding: Push icons up so they aren't covered by the system bar
          paddingBottom: insets.bottom > 0 ? insets.bottom : 10,
          paddingTop: 10,
        },
        headerShown: false,
        // Hide tabs when keyboard opens to prevent resizing issues
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'add-circle' : 'add-circle-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => {
            if (profilePic) {
              return (
                <View style={{
                  borderWidth: focused ? 2 : 0,
                  borderColor: color,
                  borderRadius: 15,
                  padding: 1,
                }}>
                  <Image
                    source={{ uri: `${process.env.EXPO_PUBLIC_API_URL}${profilePic}` }}
                    style={{ width: 24, height: 24, borderRadius: 12 }}
                  />
                </View>
              );
            }
            return (
              <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
            );
          },
        }}
      />
    </Tabs>
  );
}