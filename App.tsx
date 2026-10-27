import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { House, Route, UserRound } from 'lucide-react-native';
import { RootParams, TabParams } from './src/navigation/types';
import { AppProvider, useApp } from './src/state/AppContext';
import { colors as c } from './src/theme';
import { RouteLogo } from './src/components/RouteMap';
import { Button } from './src/components/ui';
import { LoginScreen, SetupScreen, WelcomeScreen } from './src/screens/Auth';
import {
  CreateRideScreen,
  HomeScreen,
  LocationSearchScreen,
  MapPreviewScreen,
} from './src/screens/Home';
import {
  ActiveRideScreen,
  ChatScreen,
  ChooseRideScreen,
  CompletedScreen,
  GroupRideScreen,
  MatchDetailsScreen,
  MatchingScreen,
  ResultsScreen,
  RideDetailsScreen,
} from './src/screens/Journey';
import {
  HelpScreen,
  ProfileScreen,
  RidesScreen,
  SettingsScreen,
} from './src/screens/Account';
import { ApiQuotaScreen } from './src/screens/ApiQuotaScreen';
const Stack = createNativeStackNavigator<RootParams>();
const Tabs = createBottomTabNavigator<TabParams>();
const homeIcon = ({ color, size }: { color: string; size: number }) => (
  <House color={color} size={size} strokeWidth={1.8} />
);
const ridesIcon = ({ color, size }: { color: string; size: number }) => (
  <Route color={color} size={size} strokeWidth={1.8} />
);
const profileIcon = ({ color, size }: { color: string; size: number }) => (
  <UserRound color={color} size={size} strokeWidth={1.8} />
);
const tabIcons = { Home: homeIcon, Rides: ridesIcon, Profile: profileIcon };
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: c.primary,
    background: c.background,
    card: c.background,
    text: c.text,
    border: c.border,
    notification: c.primary,
  },
};
function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.accent,
        tabBarStyle: styles.tabs,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: tabIcons[route.name],
      })}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Rides" component={RidesScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}
function AppNavigation() {
  const { state } = useApp();
  const [splash, setSplash] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setSplash(false), 550);
    return () => clearTimeout(timer);
  }, []);
  if (splash) {
    return (
      <View style={styles.splash}>
        <StatusBar barStyle="light-content" />
        <RouteLogo inverse />
        <Text style={styles.brand}>MAHE{'\n'}CARPOOL</Text>
        <Text style={styles.tagline}>Different routes. One journey.</Text>
      </View>
    );
  }
  return (
    <NavigationContainer theme={theme}>
      <StatusBar barStyle="dark-content" />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: styles.screen,
          animation: 'slide_from_right',
        }}
      >
        {state.signedIn ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="CreateRide" component={CreateRideScreen} />
            <Stack.Screen
              name="LocationSearch"
              component={LocationSearchScreen}
            />
            <Stack.Screen name="MapPreview" component={MapPreviewScreen} />
            <Stack.Screen name="Matching" component={MatchingScreen} />
            <Stack.Screen name="Results" component={ResultsScreen} />
            <Stack.Screen name="MatchDetails" component={MatchDetailsScreen} />
            <Stack.Screen name="GroupRide" component={GroupRideScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="ChooseRide" component={ChooseRideScreen} />
            <Stack.Screen name="ActiveRide" component={ActiveRideScreen} />
            <Stack.Screen name="Completed" component={CompletedScreen} />
            <Stack.Screen name="RideDetails" component={RideDetailsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="ApiQuota" component={ApiQuotaScreen} />
            <Stack.Screen name="Help" component={HelpScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="Welcome" component={WelcomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Setup" component={SetupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  { failed: boolean; session: number }
> {
  state = { failed: false, session: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.errorTitle}>The demo needs a fresh start</Text>
          <Text style={styles.errorCopy}>
            An unexpected local error interrupted this session. Restarting
            clears demo journeys.
          </Text>
          <Button
            label="Restart local demo"
            onPress={() =>
              this.setState({ failed: false, session: this.state.session + 1 })
            }
          />
        </View>
      );
    }
    return (
      <React.Fragment key={this.state.session}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AppProvider>
          <AppNavigation />
        </AppProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
const styles = StyleSheet.create({
  screen: { backgroundColor: c.background },
  tabs: { backgroundColor: c.background, borderTopColor: c.border },
  tabLabel: { fontSize: 12, fontWeight: '600' },
  splash: {
    flex: 1,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  brand: {
    fontSize: 40,
    lineHeight: 42,
    textAlign: 'center',
    color: c.inverse,
    fontWeight: '700',
    letterSpacing: 3,
  },
  tagline: { color: c.inverse, fontSize: 16 },
  fallback: {
    flex: 1,
    backgroundColor: c.background,
    justifyContent: 'center',
    padding: 24,
    gap: 24,
  },
  errorTitle: { fontSize: 28, color: c.text, fontWeight: '600' },
  errorCopy: { fontSize: 16, color: c.secondary, lineHeight: 24 },
});
