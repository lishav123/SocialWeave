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
    </Stack>
  );
}