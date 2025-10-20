// app/_layout.tsx
import { Tabs } from "expo-router";
import { Ionicons } from '@expo/vector-icons';

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#007AFF', 
        tabBarInactiveTintColor: 'gray',  
      }}
    >
      <Tabs.Screen
        name="index" 
        options={{
          title: 'Feed', 
          tabBarIcon: ({ color }) => <Ionicons size={28} name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore', 
          tabBarIcon: ({ color }) => <Ionicons size={28} name="search-outline" color={color} />,
        }}
      />
      <Tabs.Screen 
        name="upload"
        options={{
          title: "Upload",
          tabBarIcon: ({ color }) => <Ionicons size={28} name="add-circle-outline" color={color} />
      }}/>

      <Tabs.Screen
        name="profile" 
        options={{
          title: 'Profile', 
          tabBarIcon: ({ color }) => <Ionicons size={28} name="person-circle-outline" color={color} />,
      }}/>
    </Tabs>
  );
}