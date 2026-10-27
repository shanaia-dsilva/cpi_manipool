import React, { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { Bookmark, Gauge, History, Settings2, ShieldCheck } from 'lucide-react-native';
import { RootParams } from '../navigation/types';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Choice,
  Copy,
  ErrorText,
  Heading,
  Input,
  Kicker,
  Notice,
  Page,
  Title,
  ui,
} from '../components/ui';
import { RideSummary } from '../components/RideSummary';
import { newId, nowISO, useApp } from '../state/AppContext';
import { dateLabel, isOpen } from '../services/journey';
import { goMain, openRide } from '../navigation/actions';
import { colors as c } from '../theme';
export function RidesScreen() {
  const { state } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootParams>>();
  const upcoming = state.rides.filter(ride => isOpen(ride.status));
  const completed = state.rides.filter(ride => ride.status === 'COMPLETED');
  const other = state.rides.filter(ride =>
    ['CANCELLED', 'EXPIRED'].includes(ride.status),
  );
  return (
    <Page>
      <Kicker>Your campus journeys</Kicker>
      <Title>My rides</Title>
      <Copy muted>
        One place for the journeys ahead and the ones you shared.
      </Copy>
      <Heading>Upcoming · {upcoming.length}</Heading>
      {!upcoming.length && (
        <Card>
          <Copy>No upcoming rides yet.</Copy>
          <Copy small muted>
            Plan a journey and find sample students travelling your way.
          </Copy>
          <Button
            label="Plan a ride"
            onPress={() => navigation.navigate('CreateRide')}
          />
        </Card>
      )}
      {upcoming.map(ride => (
        <View key={ride.id} style={ui.gap}>
          <RideSummary
            ride={ride}
            group={state.groups.find(group => group.id === ride.groupId)}
          />
          <Button
            secondary
            label="Resume this journey"
            onPress={() => openRide(navigation, ride)}
          />
        </View>
      ))}
      <Heading>Completed · {completed.length}</Heading>
      {!completed.length && (
        <Copy muted>Your completed demo journeys will appear here.</Copy>
      )}
      {completed
        .slice()
        .reverse()
        .map(ride => (
          <View key={ride.id} style={ui.gap}>
            <RideSummary
              ride={ride}
              group={state.groups.find(group => group.id === ride.groupId)}
            />
            <Button
              secondary
              label="View completed ride"
              onPress={() => openRide(navigation, ride)}
            />
          </View>
        ))}
      {!!other.length && <Heading>Cancelled / expired</Heading>}
      {other
        .slice()
        .reverse()
        .map(ride => (
          <View key={ride.id} style={ui.gap}>
            <RideSummary ride={ride} />
            <Button
              secondary
              label="View journey record"
              onPress={() =>
                navigation.navigate('RideDetails', { rideId: ride.id })
              }
            />
          </View>
        ))}
    </Page>
  );
}
export function ProfileScreen() {
  const { state } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootParams>>();
  return (
    <Page>
      <Kicker>Part of the journey</Kicker>
      <Title>Your profile</Title>
      <Card>
        <Avatar student={state.profile} />
        <Heading>{state.profile.name}</Heading>
        <Copy small muted>
          {state.profile.email}
        </Copy>
        <Badge>Demo profile · identity unverified</Badge>
      </Card>
      <Choice
        icon={Bookmark}
        label="Saved places"
        detail={`${state.savedPlaces.length} landmarks · choose for your next journey`}
        onPress={() =>
          navigation.navigate('LocationSearch', {
            field: 'destinationId',
            savedOnly: true,
          })
        }
      />
      <Choice
        icon={History}
        label="Ride history"
        detail={`${
          state.rides.filter(ride => ride.status === 'COMPLETED').length
        } completed demo journeys`}
        onPress={() => goMain(navigation, 'Rides')}
      />
      <Choice
        icon={Gauge}
        label="Routing & API Limits"
        detail={
          state.apiQuota.googleMapsDemoMode
            ? '🔵 Google Maps Demo Active · Tap to view limits'
            : '🛡️ Safe Mode (OSRM Active) · View API Quotas'
        }
        onPress={() => navigation.navigate('ApiQuota')}
      />
      <Choice
        icon={Settings2}
        label="Settings & demo controls"
        onPress={() => navigation.navigate('Settings')}
      />
      <Choice
        icon={ShieldCheck}
        label="Help & Safety"
        onPress={() => navigation.navigate('Help')}
      />
      <Notice>
        Profile and ride data are held in memory. Restarting the app starts a
        fresh demo session.
      </Notice>
    </Page>
  );
}
export function SettingsScreen({
  navigation,
}: NativeStackScreenProps<RootParams, 'Settings'>) {
  const { state, dispatch } = useApp();
  return (
    <Page back>
      <Kicker>Make the demo yours</Kicker>
      <Title>Settings</Title>
      <Card>
        <View style={ui.spread}>
          <View style={ui.flex}>
            <Heading>Demo notifications</Heading>
            <Copy small muted>
              Local visual preference only. No push notifications are sent.
            </Copy>
          </View>
          <Switch
            accessibilityLabel="Demo notification preference"
            value={state.notifications}
            onValueChange={enabled =>
              dispatch({ type: 'NOTIFICATIONS', enabled })
            }
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor={c.surface}
          />
        </View>
        <Badge>
          {state.notifications
            ? 'Local preference enabled'
            : 'Local preference disabled'}
        </Badge>
      </Card>
      <Heading>Matching fixture</Heading>
      <Copy muted>
        Applies on the next search or retry. Each result uses deterministic
        sample riders.
      </Copy>
      <Choice
        label="Standard journey"
        detail="You + two demo riders · cab fits all three"
        selected={state.scenario === 'normal'}
        onPress={() => dispatch({ type: 'SCENARIO', scenario: 'normal' })}
      />
      <Choice
        label="No-match scenario"
        detail="Exercise retry, wider-window and edit actions"
        selected={state.scenario === 'no-match'}
        onPress={() => dispatch({ type: 'SCENARIO', scenario: 'no-match' })}
      />
      <Choice
        label="Two-rider journey"
        detail="You + one demo rider · cab or auto available"
        selected={state.scenario === 'two-riders'}
        onPress={() => dispatch({ type: 'SCENARIO', scenario: 'two-riders' })}
      />
      <Card>
        <Heading>Privacy & permissions</Heading>
        <Copy small muted>
          No GPS, contacts, camera, payment, real login or provider credentials
          are required. Demo messages stay on this device in memory.
        </Copy>
      </Card>
      <Button
        secondary
        label="Routing & Google Maps API Limits"
        onPress={() => navigation.navigate('ApiQuota')}
      />
      <Button
        secondary
        label="Help & Safety"
        onPress={() => navigation.navigate('Help')}
      />
      <Button
        secondary
        label="Reset local demo"
        onPress={() =>
          Alert.alert(
            'Start a fresh demo?',
            'This clears local rides, groups, messages, saved places and reports. Your demo profile remains.',
            [
              { text: 'Keep session', style: 'cancel' },
              {
                text: 'Reset demo',
                style: 'destructive',
                onPress: () => {
                  dispatch({ type: 'RESET' });
                  goMain(navigation);
                },
              },
            ],
          )
        }
      />
      <Copy small muted>
        MAHE Carpool · CPI prototype v1.0{'\n'}Different routes. One journey.
      </Copy>
    </Page>
  );
}
export function HelpScreen({
  route,
  navigation,
}: NativeStackScreenProps<RootParams, 'Help'>) {
  const { state, dispatch } = useApp();
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const ride = state.rides.find(item => item.id === route.params?.rideId);
  return (
    <Page back>
      <Kicker>Travel with care</Kicker>
      <Title>Help & Safety</Title>
      <Card>
        <Heading>Agree before you leave</Heading>
        <Copy>
          Meet at a public, familiar landmark. Confirm your group and pickup
          before travelling.
        </Copy>
        <Copy small muted>
          This prototype does not verify students, provide live tracking,
          monitor emergencies, or guarantee safety. Contact your campus support
          directly when needed.
        </Copy>
      </Card>
      <Card>
        <Heading>Your privacy</Heading>
        <Copy small muted>
          Only approximate rider areas appear before acceptance. No phone
          numbers are published. Reports below are local demo records, not
          messages to campus staff.
        </Copy>
      </Card>
      <Heading>Report a demo issue</Heading>
      {ride && (
        <Copy muted>
          Journey: {ride.destination.name} · {dateLabel(ride.departure)}
        </Copy>
      )}
      <Input
        multiline
        label="Describe the issue"
        value={text}
        onChangeText={value => {
          setText(value);
          setSaved(false);
        }}
        maxLength={1000}
        placeholder="Describe behaviour or a problem in the demo…"
      />
      <Button
        label="Save local demo report"
        disabled={!text.trim()}
        onPress={() => {
          dispatch({
            type: 'REPORT',
            text,
            rideId: ride?.id,
            id: newId('report'),
            now: nowISO(),
          });
          setText('');
          setSaved(true);
        }}
      />
      {saved && (
        <Notice>
          Report saved in this session. It has not been sent to anyone.
        </Notice>
      )}
      <ErrorText message={state.error} />
      <Copy small muted>
        {state.reports.length} local report
        {state.reports.length === 1 ? '' : 's'} saved.
      </Copy>
      {state.reports.map(report => (
        <Card key={report.id}>
          <Copy>{report.text}</Copy>
          <Copy small muted>
            {dateLabel(report.timestamp)} · local only
          </Copy>
        </Card>
      ))}
      {ride && isOpen(ride.status) && (
        <Button
          secondary
          label="Leave this demo journey"
          onPress={() =>
            Alert.alert(
              'Cancel your participation?',
              'Other demo riders keep their trip.',
              [
                { text: 'Stay', style: 'cancel' },
                {
                  text: 'Leave',
                  style: 'destructive',
                  onPress: () => {
                    dispatch({ type: 'LEAVE', rideId: ride.id, now: nowISO() });
                    goMain(navigation, 'Rides');
                  },
                },
              ],
            )
          }
        />
      )}
    </Page>
  );
}
