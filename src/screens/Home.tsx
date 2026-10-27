import React, { useState } from 'react';
import { Alert, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import {
  CalendarDays,
  Clock3,
  Gauge,
  MapPin,
  Navigation,
  Plane,
  Shield,
  TrainFront,
  Zap,
} from 'lucide-react-native';
import { RootParams } from '../navigation/types';
import {
  Badge,
  Button,
  Card,
  Choice,
  Copy,
  ErrorText,
  Heading,
  Kicker,
  Page,
  Row,
  Title,
  ui,
} from '../components/ui';
import { RouteLogo } from '../components/RouteMap';
import { InteractiveRouteMap } from '../components/InteractiveRouteMap';
import { RideSummary } from '../components/RideSummary';
import { getLocation, locations } from '../data/fixtures';
import { newId, nowISO, useApp } from '../state/AppContext';
import { departureFromDraft, isOpen, validateDraft } from '../services/journey';
import { openRide } from '../navigation/actions';
import { getDeviceLocationWithFallback } from '../services/location';
import { isDemoModeActive } from '../services/apiQuota';
import { colors as c } from '../theme';

export function JourneyForm() {
  const { state, dispatch } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootParams>>();
  const [error, setError] = useState<string>();
  const draft = state.draft;
  const current = state.rides.find(ride => isOpen(ride.status));
  const demoActive = isDemoModeActive(state.apiQuota);

  const chooseDate = (mode: 'date' | 'time') =>
    DateTimePickerAndroid.open({
      value: departureFromDraft(draft) ?? new Date(),
      mode,
      is24Hour: false,
      minimumDate: mode === 'date' ? new Date() : undefined,
      onChange: (event, selected) => {
        if (event.type !== 'set' || !selected) {
          return;
        }
        dispatch({
          type: 'DRAFT',
          patch:
            mode === 'date'
              ? {
                  date: `${selected.getFullYear()}-${String(
                    selected.getMonth() + 1,
                  ).padStart(2, '0')}-${String(selected.getDate()).padStart(
                    2,
                    '0',
                  )}`,
                }
              : {
                  time: `${String(selected.getHours()).padStart(
                    2,
                    '0',
                  )}:${String(selected.getMinutes()).padStart(2, '0')}`,
                },
        });
      },
    });

  const find = () => {
    if (current) {
      Alert.alert(
        'One journey at a time',
        'Resume or cancel your existing demo request first.',
        [
          { text: 'Back', style: 'cancel' },
          {
            text: 'Resume journey',
            onPress: () => openRide(navigation, current),
          },
        ],
      );
      return;
    }
    const validation = validateDraft(draft, Date.now(), state.customPlaces);
    setError(validation);
    if (validation) {
      return;
    }
    const id = newId('ride');
    dispatch({ type: 'SEARCH', id, now: nowISO() });
    navigation.navigate('Matching', { rideId: id });
  };

  const pickupLoc = getLocation(draft.pickupId, state.customPlaces);
  const destLoc = getLocation(draft.destinationId, state.customPlaces);

  return (
    <Card>
      {/* Routing mode status pill */}
      <TouchableOpacity
        onPress={() => navigation.navigate('ApiQuota')}
        accessibilityLabel="Routing and API limits"
        style={styles.apiModePill}
      >
        <Row>
          {demoActive ? (
            <Zap size={14} color={c.accent} />
          ) : (
            <Shield size={14} color="#2E7D32" />
          )}
          <Copy small style={demoActive ? styles.apiModeActive : styles.apiModeSafe}>
            {demoActive ? 'Google Maps Demo Active' : 'Safe Routing Mode (OSRM)'}
          </Copy>
          <Gauge size={14} color={c.accent} style={styles.apiGaugeIcon} />
        </Row>
      </TouchableOpacity>

      <Choice
        icon={MapPin}
        label={pickupLoc?.name ?? 'Choose pickup'}
        detail={pickupLoc?.area ?? 'Pickup · campus or landmark'}
        onPress={() =>
          navigation.navigate('LocationSearch', { field: 'pickupId' })
        }
      />
      <Choice
        icon={Navigation}
        label={destLoc?.name ?? 'Choose destination'}
        detail={destLoc?.area ?? 'Where are you headed?'}
        onPress={() =>
          navigation.navigate('LocationSearch', { field: 'destinationId' })
        }
      />
      <Row>
        <View style={ui.flex}>
          <Choice
            icon={CalendarDays}
            label={draft.date}
            detail="Departure date"
            onPress={() => chooseDate('date')}
          />
        </View>
        <View style={ui.flex}>
          <Choice
            icon={Clock3}
            label={draft.time}
            detail="Departure time"
            onPress={() => chooseDate('time')}
          />
        </View>
      </Row>
      <Copy small>Time flexibility</Copy>
      <Row wrap>
        {([0, 15, 30, 45] as const).map(minutes => (
          <Choice
            key={minutes}
            label={minutes ? `±${minutes} min` : 'Exact time'}
            selected={draft.flexibility === minutes}
            onPress={() =>
              dispatch({ type: 'DRAFT', patch: { flexibility: minutes } })
            }
          />
        ))}
      </Row>
      <ErrorText message={error ?? state.error} />
      <Button label="Find a Carpool" onPress={find} />
      <Button
        secondary
        label="Preview road route"
        onPress={() => navigation.navigate('MapPreview')}
      />
    </Card>
  );
}

export function HomeScreen() {
  const { state, dispatch } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootParams>>();
  const upcoming = state.rides.find(ride =>
    ['GROUP_FORMED', 'RIDE_BOOKED', 'IN_PROGRESS'].includes(ride.status),
  );
  const demoActive = isDemoModeActive(state.apiQuota);

  return (
    <Page>
      <View style={ui.spread}>
        <RouteLogo />
        <TouchableOpacity
          onPress={() => navigation.navigate('ApiQuota')}
          accessibilityLabel="Open API controls"
        >
          <Badge>
            {demoActive ? 'GMaps Demo On' : 'Safe Mode (OSRM)'}
          </Badge>
        </TouchableOpacity>
      </View>
      <Kicker>Hello, {state.profile.name.split(' ')[0]}</Kicker>
      <Title>Where are{'\n'}you going?</Title>
      <Copy muted>
        Different routes. One journey.{'\n'}Ready to share a ride?
      </Copy>
      <JourneyForm />
      <Heading>Campus favourites</Heading>
      <Row wrap>
        {locations
          .filter(location =>
            ['airport', 'metro', 'railway', 'kogilu'].includes(location.id),
          )
          .map(location => (
            <Choice
              key={location.id}
              icon={location.kind === 'airport' ? Plane : TrainFront}
              label={location.name}
              onPress={() =>
                dispatch({
                  type: 'DRAFT',
                  patch: { destinationId: location.id },
                })
              }
            />
          ))}
      </Row>
      {upcoming && (
        <>
          <Heading>Your upcoming journey</Heading>
          <RideSummary
            ride={upcoming}
            group={state.groups.find(group => group.id === upcoming.groupId)}
          />
          <Button
            secondary
            label="Resume journey"
            onPress={() => openRide(navigation, upcoming)}
          />
        </>
      )}
      <Copy small muted>
        Bengaluru road-network estimates. Quotas protected by Shanaia's Demo Guard.
      </Copy>
    </Page>
  );
}

export function CreateRideScreen() {
  return (
    <Page back>
      <Kicker>A journey worth sharing</Kicker>
      <Title>Plan your ride</Title>
      <Copy muted>
        Choose landmarks and a departure window that works for you.
      </Copy>
      <JourneyForm />
    </Page>
  );
}

export function LocationSearchScreen({
  route,
}: import('@react-navigation/native-stack').NativeStackScreenProps<
  RootParams,
  'LocationSearch'
>) {
  const { state, dispatch } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootParams>>();
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);

  const allAvailable = [...locations, ...state.customPlaces];
  const options = allAvailable.filter(
    location =>
      (!route.params.savedOnly || state.savedPlaces.includes(location.id)) &&
      `${location.name} ${location.area}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  // Device location handler with permission checks & fallback behavior
  const handleUseMyLocation = async () => {
    setLocating(true);
    try {
      const result = await getDeviceLocationWithFallback();
      if (result.status === 'granted' && result.coordinate) {
        // If location is custom/gps, select place
        if (result.resolvedLocation.source === 'gps') {
          dispatch({
            type: 'SELECT_PLACE',
            field: route.params.field,
            location: result.resolvedLocation,
          });
        } else {
          dispatch({
            type: 'DRAFT',
            patch: { [route.params.field]: result.resolvedLocation.id },
          });
        }
        Alert.alert('Location Detected', result.message, [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        // Fallback behavior
        dispatch({
          type: 'DRAFT',
          patch: { [route.params.field]: result.resolvedLocation.id },
        });
        Alert.alert(
          'Location Fallback',
          result.message + ' You can also pick any campus gate manually.',
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } catch {
      // Safe fallback to campus
      dispatch({
        type: 'DRAFT',
        patch: { [route.params.field]: 'gate' },
      });
      navigation.goBack();
    } finally {
      setLocating(false);
    }
  };

  return (
    <Page back>
      <Kicker>Bengaluru Locations</Kicker>
      <Title>
        {route.params.savedOnly
          ? 'Saved places'
          : route.params.field === 'pickupId'
          ? 'Choose your pickup'
          : 'Choose a destination'}
      </Title>
      <Copy muted>
        Select verified campus pickup bays, transit hubs, or use device GPS.
      </Copy>
      <TextInput
        accessibilityLabel="Search demo locations"
        placeholder="Search campus, airport, metro, Yelahanka…"
        value={query}
        onChangeText={setQuery}
        style={{ ...uiInput }}
        placeholderTextColor={c.accent}
      />

      {/* Device location button with permission & fallback handling */}
      <Button
        secondary
        label={
          locating
            ? 'Detecting device location…'
            : 'Use my device location (with fallback)'
        }
        disabled={locating}
        onPress={handleUseMyLocation}
      />

      <Button
        secondary
        label="Use campus main gate (safe pickup bay)"
        onPress={() => {
          dispatch({
            type: 'DRAFT',
            patch: { [route.params.field]: 'gate' },
          });
          navigation.goBack();
        }}
      />

      {options.map(location => (
        <Card key={location.id}>
          <Choice
            icon={MapPin}
            label={location.name}
            detail={`${location.area}${
              location.accessNote ? ` • ${location.accessNote}` : ''
            }`}
            selected={state.draft[route.params.field] === location.id}
            onPress={() => {
              dispatch({
                type: 'DRAFT',
                patch: { [route.params.field]: location.id },
              });
              navigation.goBack();
            }}
          />
          <Button
            secondary
            label={
              state.savedPlaces.includes(location.id)
                ? 'Remove from saved places'
                : 'Save this place'
            }
            onPress={() => dispatch({ type: 'SAVE', locationId: location.id })}
          />
        </Card>
      ))}
      {!options.length && (
        <Copy muted>
          No places found matching "{query}". Try "campus", "airport", "metro", or "yelahanka".
        </Copy>
      )}
    </Page>
  );
}

const uiInput = {
  minHeight: 54,
  borderWidth: 1,
  borderColor: c.border,
  borderRadius: 14,
  padding: 16,
  backgroundColor: c.surface,
  color: c.text,
  fontSize: 16,
};

export function MapPreviewScreen() {
  const { state } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootParams>>();
  const pickup = getLocation(state.draft.pickupId, state.customPlaces) ?? locations[0];
  const destination =
    getLocation(state.draft.destinationId, state.customPlaces) ?? locations[3];

  return (
    <Page back>
      <Kicker>Road-Network Routing</Kicker>
      <Title>Your journey,{'\n'}on the road.</Title>
      <Copy muted>
        Calculated using actual Bengaluru arterial road distances and travel times.
      </Copy>

      {/* Interactive Road Map */}
      <InteractiveRouteMap pickup={pickup} destination={destination} />

      <Row>
        <View style={ui.flex}>
          <Button
            secondary
            label="Change pickup"
            onPress={() =>
              navigation.navigate('LocationSearch', { field: 'pickupId' })
            }
          />
        </View>
        <View style={ui.flex}>
          <Button
            secondary
            label="Change destination"
            onPress={() =>
              navigation.navigate('LocationSearch', { field: 'destinationId' })
            }
          />
        </View>
      </Row>

      <Button
        secondary
        label="View API Limits & Controls"
        onPress={() => navigation.navigate('ApiQuota')}
      />

      <Button
        label="Return to journey form"
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: 'Main', params: { screen: 'Home' } }],
          })
        }
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  apiModePill: {
    backgroundColor: '#F7F4EE',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 6,
  },
  apiModeSafe: {
    color: '#2E7D32',
    fontWeight: '600',
    marginLeft: 6,
  },
  apiModeActive: {
    color: '#E65100',
    fontWeight: '600',
    marginLeft: 6,
  },
  apiGaugeIcon: {
    marginLeft: 'auto',
  },
});
