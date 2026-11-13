import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/AuthContext';
import Auth from './src/screens/Auth';
import Home from './src/screens/Home';
import ModuleList from './src/screens/ModuleList';
import ModuleForm from './src/screens/ModuleForm';
import Timeline from './src/screens/Timeline';
import Profile from './src/screens/Profile';
import LockGate from './src/LockGate';
import { Btn, colors } from './src/ui';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={({ route }) => ({
      headerStyle: { backgroundColor: colors.dark }, headerTintColor: '#fff', tabBarActiveTintColor: colors.brand,
      tabBarIcon: ({ color, size }) => <Ionicons name={route.name === 'Home' ? 'grid-outline' : 'person-outline'} size={size} color={color} />,
    })}>
      <Tabs.Screen name="Home" component={Home} options={{ title: 'ClinicCare' }} />
      <Tabs.Screen name="Profile" component={Profile} options={{ title: 'My Profile' }} />
    </Tabs.Navigator>
  );
}

function Root() {
  const { user, profile, ready, logout } = useAuth();
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={colors.brand} /></View>;
  if (!user) return <Auth />;
  if (!profile) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}><Text>Setting up your account...</Text><Btn title="Sign out" ghost onPress={logout} /></View>;
  if (profile.active === false) return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 24 }}><Text>This account is deactivated. Contact the clinic.</Text><Btn title="Sign out" ghost onPress={logout} /></View>;

  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.dark }, headerTintColor: '#fff' }}>
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="ModuleList" component={ModuleList} />
      <Stack.Screen name="ModuleForm" component={ModuleForm} />
      <Stack.Screen name="Timeline" component={Timeline} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <LockGate><Root /></LockGate>
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
