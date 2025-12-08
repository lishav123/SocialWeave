import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      {/* Add this new line: */}
      <Stack.Screen 
        name="edit-profile" 
        options={{ 
          presentation: 'modal', // This makes it slide up nicely like a form (optional)
          title: 'Edit Profile'  // Or set headerShown: false if you use your own custom header
        }} 
      />

      {/* ... existing screens ... */}
      
      <Stack.Screen 
        name="user-profile" 
        options={{ 
          title: 'Profile', 
          headerBackTitle: 'Back', // iOS back button text
          headerShown: true // We want a header for back button
        }} 
      />
      
      <Stack.Screen 
        name="comments" 
        options={{ 
          title: 'Comments',
          presentation: 'modal', // Nice slide-up effect
          headerShown: true 
        }} 
      />
      <Stack.Screen 
        name="post-details" 
        options={{ 
          title: 'Post',
          headerBackTitle: 'Back',
        }} 
      />
    </Stack>
  );
}