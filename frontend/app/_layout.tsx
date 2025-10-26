import { Stack } from 'expo-router';

// This is the root layout for the entire app.
export default function RootLayout() {
    return (
        <Stack>
            {/* This screen points to our (auth)/login.tsx file.
                We hide the header for this screen.
            */}
            <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)/register" options={{ headerShown: false }} />

            {/* This screen points to our (tabs) group.
                It's the "boss" of our entire 4-tab section.
            */}
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
    );
}