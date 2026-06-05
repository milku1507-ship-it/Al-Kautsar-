import { Stack } from 'expo-router';
import React from 'react';

export default function WizardLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="profil" />
      <Stack.Screen name="kalender" />
      <Stack.Screen name="adat" />
      <Stack.Screen name="waktu" />
      <Stack.Screen name="hasil" />
    </Stack>
  );
}
