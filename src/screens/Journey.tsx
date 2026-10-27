import React, { useEffect, useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { RootParams } from '../navigation/types';
import {
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
  Riders,
  Title,
  ui,
} from '../components/ui';
import { RouteMap } from '../components/RouteMap';
import { InteractiveRouteMap } from '../components/InteractiveRouteMap';
import { FareBreakdown, RideSummary } from '../components/RideSummary';
import { newId, nowISO, useApp } from '../state/AppContext';
import { quickMessages, vehicleOptions } from '../data/fixtures';
import { dateLabel, isOpen, money, splitFare } from '../services/journey';
import { comparePickupArrangements } from '../services/pickupOptimization';
import { CarpoolGroup, RideRequest } from '../types/domain';
import { colors as c } from '../theme';
import { goMain, openRide } from '../navigation/actions';

type Props<Name extends keyof RootParams> = NativeStackScreenProps<
  RootParams,
  Name
>;
function Missing({
  navigation,
}: {
  navigation: NativeStackNavigationProp<RootParams>;
}) {
  return (
    <Page back>
      <Title>This journey is unavailable</Title>
      <Copy muted>
        Return home to create a demo request or open your ride history.
      </Copy>
      <Button label="Return Home" onPress={() => goMain(navigation)} />
    </Page>
  );
}
function useRide(rideId: string) {
  const app = useApp();
  const ride = app.state.rides.find(item => item.id === rideId);
  const group = app.state.groups.find(item => item.id === ride?.groupId);
  return { ...app, ride, group };
}
function pickupName(ride: RideRequest, group: CarpoolGroup) {
  return group.pickupMode === 'common'
    ? ['campus', 'gate'].includes(ride.pickup.id)
      ? 'Campus main gate · meeting area'
      : `${ride.pickup.name} · landmark entrance`
    : 'Sequential pickups in rider order';
}
function useLeave(
  navigation: NativeStackNavigationProp<RootParams>,
  rideId: string,
) {
  const { dispatch } = useApp();
  return () =>
    Alert.alert(
      'Leave this demo journey?',
      'Your request will be cancelled. Any remaining demo riders keep their group, and their fare split is recalculated.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave journey',
          style: 'destructive',
          onPress: () => {
            dispatch({ type: 'LEAVE', rideId, now: nowISO() });
            goMain(navigation, 'Rides');
          },
        },
      ],
    );
}
export function MatchingScreen({ route, navigation }: Props<'Matching'>) {
  const { ride, dispatch } = useRide(route.params.rideId);
  const leave = useLeave(navigation, route.params.rideId);
  useEffect(() => {
    if (!ride) {
      return;
    }
    if (['SEARCHING', 'REMATCHING'].includes(ride.status)) {
      const timer = setTimeout(
        () => dispatch({ type: 'SEARCH_DONE', rideId: ride.id, now: nowISO() }),
        1500,
      );
      return () => clearTimeout(timer);
    }
    if (['MATCH_FOUND', 'NO_MATCH'].includes(ride.status)) {
      navigation.replace('Results', { rideId: ride.id });
    } else {
      navigation.replace('RideDetails', { rideId: ride.id });
    }
  }, [ride, dispatch, navigation]);
  if (!ride) {
    return <Missing navigation={navigation} />;
  }
  return (
    <Page back>
      <Kicker>Bringing journeys together</Kicker>
      <Title>Finding students{'\n'}travelling your way…</Title>
      <RouteMap animated start={ride.pickup.area} end={ride.destination.name} />
      <Card>
        <Copy>01 · Comparing departure windows</Copy>
        <Copy>02 · Checking nearby pickup areas</Copy>
        <Copy>03 · Comparing routes and detours</Copy>
      </Card>
      <Notice>
        A short local simulation using deterministic sample riders. No real
        requests are sent.
      </Notice>
      <Button secondary label="Cancel search" onPress={leave} />
    </Page>
  );
}
export function ResultsScreen({ route, navigation }: Props<'Results'>) {
  const { ride, state, dispatch } = useRide(route.params.rideId);
  if (!ride) {
    return <Missing navigation={navigation} />;
  }
  const retry = (expand = false) => {
    if (expand) {
      dispatch({ type: 'SCENARIO', scenario: 'normal' });
    }
    dispatch({
      type: 'REMATCH',
      rideId: ride.id,
      flexibility: expand ? 45 : undefined,
    });
    navigation.replace('Matching', { rideId: ride.id });
  };
  if (!['NO_MATCH', 'MATCH_FOUND'].includes(ride.status)) {
    return (
      <Page back>
        <RideSummary ride={ride} />
        <Button
          label="Resume journey"
          onPress={() => openRide(navigation, ride)}
        />
      </Page>
    );
  }
  const edit = () => {
    dispatch({ type: 'LEAVE', rideId: ride.id, now: nowISO() });
    navigation.replace('CreateRide');
  };
  return (
    <Page back>
      <Kicker>
        {ride.matches.length ? 'Your paths align' : 'A little more flexibility'}
      </Kicker>
      <Title>
        {ride.matches.length
          ? 'We found a\ngreat match.'
          : 'No demo match\nthis time.'}
      </Title>
      <Copy muted>
        {ride.destination.name} · {dateLabel(ride.departure)}
      </Copy>
      <InteractiveRouteMap pickup={ride.pickup} destination={ride.destination} />
      {ride.matches.length ? (
        <Card>
          <Badge>Excellent Match · sample riders</Badge>
          <Heading>{ride.matches.length + 1} students, one direction</Heading>
          <Riders
            members={ride.matches.map(match => match.student)}
            detail="Waiting for acceptance"
          />
          <Copy small muted>
            Estimated pickup detour: up to{' '}
            {Math.max(...ride.matches.map(match => match.detourMinutes))} min
          </Copy>
          <Copy>
            Estimated share from{' '}
            {money(
              splitFare(
                vehicleOptions[0].farePaise,
                ride.matches.length + 1,
              )[0],
            )}
          </Copy>
          <Button
            label="View Match"
            onPress={() =>
              navigation.navigate('MatchDetails', { rideId: ride.id })
            }
          />
        </Card>
      ) : (
        <Card>
          <Heading>Try a wider departure window</Heading>
          <Copy muted>
            Consider nearby landmarks or more flexible timing. This demo does
            not monitor for riders in the background.
          </Copy>
          <Button
            label="Try wider window · sample match"
            onPress={() => retry(true)}
          />
          <Copy small muted>
            Switches the fixture to sample riders and increases flexibility to
            ±45 minutes.
          </Copy>
        </Card>
      )}
      <Button
        secondary
        label="Keep Searching · rerun demo"
        onPress={() => retry()}
      />
      <Button secondary label="Edit request" onPress={edit} />
      <ErrorText message={state.error} />
    </Page>
  );
}
export function MatchDetailsScreen({
  route,
  navigation,
}: Props<'MatchDetails'>) {
  const { ride, group, state, dispatch } = useRide(route.params.rideId);
  const leave = useLeave(navigation, route.params.rideId);
  if (!ride) {
    return <Missing navigation={navigation} />;
  }
  const waiting = ride.status === 'WAITING_FOR_ACCEPTANCE';
  return (
    <Page back>
      <Kicker>Meet your possible carpool</Kicker>
      <Title>{ride.destination.name}</Title>
      <Copy muted>{dateLabel(ride.departure)}</Copy>
      <RouteMap start="Approximate pickup areas" end={ride.destination.name} />
      <Card>
        <Heading>Travelling together</Heading>
        <Riders
          members={[state.profile]}
          detail={waiting || group ? 'Joined · demo' : 'Waiting'}
        />
        <Riders
          members={ride.matches.map(match => match.student)}
          detail={group ? 'Joined · simulated' : 'Waiting'}
        />
        <Copy small muted>
          Nearby sample pickup areas only. Agreed meeting details appear after
          the group forms.
        </Copy>
        <Copy>Estimated detour: 3–4 minutes</Copy>
        <Copy>Estimated cab total: {money(vehicleOptions[0].farePaise)}</Copy>
      </Card>
      <Notice>
        You decide whether to join. Other riders only accept when you run the
        explicit demo acceptance step.
      </Notice>
      <ErrorText message={state.error} />
      {group ? (
        <Button
          label="View your carpool"
          onPress={() => navigation.replace('GroupRide', { rideId: ride.id })}
        />
      ) : waiting ? (
        <>
          <Badge>You joined · waiting for demo riders</Badge>
          <Button
            label="Simulate other riders accepting"
            onPress={() => {
              dispatch({ type: 'ACCEPT_DEMO', rideId: ride.id, now: nowISO() });
              navigation.replace('GroupRide', { rideId: ride.id });
            }}
          />
        </>
      ) : ride.status === 'MATCH_FOUND' ? (
        <Button
          label="Join Carpool"
          onPress={() =>
            dispatch({ type: 'JOIN', rideId: ride.id, now: nowISO() })
          }
        />
      ) : (
        <Button
          label="View current ride state"
          onPress={() => openRide(navigation, ride)}
        />
      )}
      {isOpen(ride.status) && (
        <Button
          secondary
          label={waiting ? 'Withdraw acceptance' : 'Decline this journey'}
          onPress={leave}
        />
      )}
    </Page>
  );
}
export function GroupRideScreen({ route, navigation }: Props<'GroupRide'>) {
  const { ride, group, state, dispatch } = useRide(route.params.rideId);
  const leave = useLeave(navigation, route.params.rideId);
  if (!ride || !group) {
    return <Missing navigation={navigation} />;
  }
  if (ride.status === 'CANCELLED') {
    return (
      <Page back>
        <Title>You left this carpool</Title>
        <Copy muted>The remaining demo riders retain their trip.</Copy>
        <FareBreakdown group={group} />
        <Button
          label="View journey record"
          onPress={() => navigation.replace('RideDetails', { rideId: ride.id })}
        />
      </Page>
    );
  }
  const pickupAnalysis = comparePickupArrangements(
    ride.pickup,
    ride.destination,
    group.members,
  );
  const activeArrangement =
    group.pickupMode === 'common'
      ? pickupAnalysis.common
      : pickupAnalysis.sequential;
  const sequentialWaypoints =
    group.pickupMode === 'sequential'
      ? pickupAnalysis.sequential.stops
          .slice(1)
          .map(stop => stop.coordinate)
      : undefined;

  return (
    <Page back>
      <Kicker>Individual routes. Shared journey.</Kicker>
      <Title>Your carpool{'\n'}is together.</Title>
      <RideSummary ride={ride} group={group} />
      <InteractiveRouteMap
        pickup={
          group.pickupMode === 'common' && group.meetingPoint
            ? group.meetingPoint
            : ride.pickup
        }
        destination={ride.destination}
        waypoints={sequentialWaypoints}
        arrangement={activeArrangement}
      />
      <Card>
        <Heading>{group.members.length} demo riders</Heading>
        <Riders members={group.members} detail="Joined" />
      </Card>
      <Card muted>
        <Heading>Suggested pickup arrangement</Heading>
        <Copy>{pickupName(ride, group)}</Copy>
        <Copy small>
          Departure window:{' '}
          {dateLabel(
            new Date(
              Date.parse(ride.departure) - ride.flexibility * 60000,
            ).toISOString(),
          )}{' '}
          –{' '}
          {dateLabel(
            new Date(
              Date.parse(ride.departure) + ride.flexibility * 60000,
            ).toISOString(),
          )}
        </Copy>
        <Notice>{pickupAnalysis.recommendationSummary}</Notice>
        <Choice
          label="Common meeting point"
          detail={`Approx. ${pickupAnalysis.common.averageWalkingDistanceMeters} m walk per rider · ${pickupAnalysis.common.totalDetourMinutes} min vehicle detour (${pickupAnalysis.common.meetingPointName ?? 'Campus Main Gate'})`}
          selected={group.pickupMode === 'common'}
          disabled={ride.status !== 'GROUP_FORMED'}
          onPress={() =>
            dispatch({
              type: 'PICKUP',
              rideId: ride.id,
              mode: 'common',
              now: nowISO(),
            })
          }
        />
        <Choice
          label="Sequential pickups (Ordered route)"
          detail={`${group.members
            .map(member => member.name)
            .join(' → ')} · approx. ${
            pickupAnalysis.sequential.totalDetourMinutes
          } min detour (${pickupAnalysis.sequential.totalDetourKm} km)`}
          selected={group.pickupMode === 'sequential'}
          disabled={ride.status !== 'GROUP_FORMED'}
          onPress={() =>
            dispatch({
              type: 'PICKUP',
              rideId: ride.id,
              mode: 'sequential',
              now: nowISO(),
            })
          }
        />
        <Copy small muted>
          Feasibility rating:{' '}
          {group.pickupMode === 'common'
            ? `${pickupAnalysis.common.feasibilityScore}/10 · ${pickupAnalysis.common.safetyRating}`
            : `${pickupAnalysis.sequential.feasibilityScore}/10 · ${pickupAnalysis.sequential.safetyRating}`}
        </Copy>
      </Card>
      <FareBreakdown group={group} />
      <ErrorText message={state.error} />
      {ride.status === 'GROUP_FORMED' ? (
        <Button
          label="Choose Cab / Auto"
          onPress={() => navigation.navigate('ChooseRide', { rideId: ride.id })}
        />
      ) : (
        <Button
          label="View ride status"
          onPress={() => openRide(navigation, ride)}
        />
      )}
      <Button
        secondary
        label="Open group chat"
        onPress={() => navigation.navigate('Chat', { rideId: ride.id })}
      />
      {isOpen(ride.status) && (
        <Button secondary label="Leave carpool" onPress={leave} />
      )}
    </Page>
  );
}
export function ChatScreen({ route, navigation }: Props<'Chat'>) {
  const { ride, group, state, dispatch } = useRide(route.params.rideId);
  const [text, setText] = useState('');
  const leave = useLeave(navigation, route.params.rideId);
  if (!ride || !group || ride.status === 'CANCELLED') {
    return <Missing navigation={navigation} />;
  }
  const send = (message: string) => {
    if (!message.trim()) {
      return;
    }
    dispatch({
      type: 'MESSAGE',
      rideId: ride.id,
      text: message,
      now: nowISO(),
      id: newId('message'),
    });
    setText('');
  };
  const quick = (message: string) => {
    if (message === "I'm cancelling") {
      leave();
    } else if (message === 'Ride booked') {
      if (group.booking) {
        send('Ride booked · simulated booking confirmed');
      } else {
        navigation.navigate('ChooseRide', { rideId: ride.id });
      }
    } else if (message === 'Can we leave 10 minutes later?') {
      if (ride.status === 'GROUP_FORMED') {
        dispatch({ type: 'DELAY', rideId: ride.id, now: nowISO() });
      } else {
        send(message);
      }
    } else {
      send(message);
    }
  };
  return (
    <Page back>
      <Kicker>{ride.destination.name}</Kicker>
      <Title>Your shared chat</Title>
      <Notice>
        Messages stay in local demo state. They are not delivered to real
        people.
      </Notice>
      {group.messages.map(message => (
        <View
          key={message.id}
          style={[
            styles.bubble,
            message.senderId === state.profile.id && styles.ownBubble,
            message.system && styles.systemBubble,
          ]}
        >
          <Copy small muted>
            {message.system ? 'Carpool update' : message.sender} ·{' '}
            {new Date(message.timestamp).toLocaleTimeString('en-IN', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Copy>
          <Copy>{message.text}</Copy>
        </View>
      ))}
      {ride.status !== 'COMPLETED' && (
        <>
          <Heading>Quick coordination</Heading>
          <View style={ui.gap}>
            {quickMessages.map(message => (
              <Choice
                key={message}
                label={message}
                onPress={() => quick(message)}
              />
            ))}
          </View>
          <Input
            label="Message your demo group"
            multiline
            maxLength={500}
            value={text}
            onChangeText={setText}
            placeholder="Agree a meeting point…"
          />
          <Button
            label="Send message"
            disabled={!text.trim()}
            onPress={() => send(text)}
          />
        </>
      )}
      <ErrorText message={state.error} />
      {ride.status === 'COMPLETED' && (
        <Copy muted>This completed chat is read-only.</Copy>
      )}
    </Page>
  );
}
export function ChooseRideScreen({ route, navigation }: Props<'ChooseRide'>) {
  const { ride, group, state, dispatch } = useRide(route.params.rideId);
  const [selected, setSelected] = useState<'cab' | 'auto'>('cab');
  if (!ride || !group || ride.status === 'CANCELLED') {
    return <Missing navigation={navigation} />;
  }
  const option =
    vehicleOptions.find(item => item.id === selected) ?? vehicleOptions[0];
  const suitable = group.members.length <= option.capacity;
  return (
    <Page back>
      <Kicker>Coordinate the next step</Kicker>
      <Title>A ride that{'\n'}fits everyone.</Title>
      <Copy muted>
        {group.members.length} demo riders · {ride.destination.name}
      </Copy>
      {vehicleOptions.map(item => (
        <Choice
          key={item.id}
          label={item.name}
          detail={`${item.capacity} passenger seats · ${money(
            item.farePaise,
          )} estimated total${
            group.members.length > item.capacity
              ? ' · unsuitable for this group'
              : ''
          }`}
          selected={selected === item.id}
          disabled={
            group.members.length > item.capacity ||
            ride.status !== 'GROUP_FORMED'
          }
          onPress={() => setSelected(item.id)}
        />
      ))}
      <Card>
        <Heading>{option.name}</Heading>
        <Copy>Estimated total: {money(option.farePaise)}</Copy>
        <Copy>
          Suggested share:{' '}
          {money(splitFare(option.farePaise, group.members.length)[0])} per
          rider
        </Copy>
        <Copy small muted>
          No provider will be contacted. This confirms a simulated booking only.
        </Copy>
      </Card>
      <ErrorText message={state.error} />
      {ride.status === 'GROUP_FORMED' ? (
        <Button
          label="Confirm simulated booking"
          disabled={!suitable}
          onPress={() =>
            Alert.alert(
              'Confirm demo booking?',
              `${option.name} · ${money(
                option.farePaise,
              )} illustrative total. No real booking or payment.`,
              [
                { text: 'Back', style: 'cancel' },
                {
                  text: 'Confirm demo',
                  onPress: () => {
                    dispatch({
                      type: 'BOOK',
                      rideId: ride.id,
                      optionId: selected,
                      now: nowISO(),
                    });
                    navigation.replace('ActiveRide', { rideId: ride.id });
                  },
                },
              ],
            )
          }
        />
      ) : (
        <Button
          label="View confirmed ride"
          onPress={() => openRide(navigation, ride)}
        />
      )}
    </Page>
  );
}
export function ActiveRideScreen({ route, navigation }: Props<'ActiveRide'>) {
  const { ride, group, state, dispatch } = useRide(route.params.rideId);
  const [shareError, setShareError] = useState<string>();
  const leave = useLeave(navigation, route.params.rideId);
  if (
    !ride ||
    !group?.booking ||
    !['RIDE_BOOKED', 'IN_PROGRESS'].includes(ride.status)
  ) {
    return <Missing navigation={navigation} />;
  }
  const active = ride.status === 'IN_PROGRESS';
  const share = async () => {
    try {
      await Share.share({
        message: `MAHE Carpool · DEMO JOURNEY ONLY\n${
          ride.destination.name
        }\n${dateLabel(ride.departure)}\nPickup: ${pickupName(ride, group)}\n${
          group.members.length
        } sample riders. No live tracking or actual booking.`,
      });
    } catch (error) {
      setShareError(
        error instanceof Error
          ? error.message
          : 'Sharing is unavailable on this device. Ride details remain visible here.',
      );
    }
  };
  return (
    <Page back>
      <Kicker>
        {active ? 'The journey is underway' : 'Simulated booking confirmed'}
      </Kicker>
      <Title>
        {active ? 'Together,\non your way.' : 'Your shared ride\nis ready.'}
      </Title>
      <RideSummary ride={ride} group={group} />
      <InteractiveRouteMap
        pickup={
          group.pickupMode === 'common' && group.meetingPoint
            ? group.meetingPoint
            : ride.pickup
        }
        destination={ride.destination}
      />
      <Card>
        <Heading>{group.booking.option.name} · demo</Heading>
        <Copy>Agreed pickup: {pickupName(ride, group)}</Copy>
        <Copy muted>Scheduled departure: {dateLabel(ride.departure)}</Copy>
        <Riders members={group.members} />
        <Copy small muted>
          No live driver, vehicle, ETA or location is being tracked.
        </Copy>
      </Card>
      <FareBreakdown group={group} />
      <ErrorText message={shareError ?? state.error} />
      <Button
        label={active ? 'Complete Demo Ride' : 'Start Demo Ride'}
        onPress={() => {
          dispatch({
            type: active ? 'COMPLETE' : 'START',
            rideId: ride.id,
            now: nowISO(),
          });
          if (active) {
            navigation.replace('Completed', { rideId: ride.id });
          }
        }}
      />
      <Button
        secondary
        label="View Ride Details"
        onPress={() => navigation.navigate('RideDetails', { rideId: ride.id })}
      />
      <Button secondary label="Share Demo Ride Details" onPress={share} />
      <Button
        secondary
        label="Open group chat"
        onPress={() => navigation.navigate('Chat', { rideId: ride.id })}
      />
      <Button secondary label="Leave journey" onPress={leave} />
    </Page>
  );
}
export function CompletedScreen({ route, navigation }: Props<'Completed'>) {
  const { ride, group } = useRide(route.params.rideId);
  if (!ride || !group || ride.status !== 'COMPLETED') {
    return <Missing navigation={navigation} />;
  }
  return (
    <Page back>
      <Kicker>Destination reached · demo complete</Kicker>
      <Title>Different routes.{'\n'}One good journey.</Title>
      <InteractiveRouteMap
        pickup={
          group.pickupMode === 'common' && group.meetingPoint
            ? group.meetingPoint
            : ride.pickup
        }
        destination={ride.destination}
      />
      <Card>
        <Heading>{ride.destination.name}</Heading>
        <Copy>
          You shared this demo journey with {group.members.length - 1} fellow
          students.
        </Copy>
        <Copy muted>{dateLabel(ride.departure)}</Copy>
      </Card>
      <FareBreakdown group={group} />
      <Button
        label="Done · View ride history"
        onPress={() => goMain(navigation, 'Rides')}
      />
      <Button
        secondary
        label="Report an Issue"
        onPress={() => navigation.navigate('Help', { rideId: ride.id })}
      />
    </Page>
  );
}
export function RideDetailsScreen({ route, navigation }: Props<'RideDetails'>) {
  const { ride, group } = useRide(route.params.rideId);
  const leave = useLeave(navigation, route.params.rideId);
  if (!ride) {
    return <Missing navigation={navigation} />;
  }
  return (
    <Page back>
      <Kicker>Your journey record</Kicker>
      <Title>Ride details</Title>
      <RideSummary ride={ride} group={group} />
      {group && (
        <>
          <Card>
            <Heading>
              {ride.status === 'CANCELLED'
                ? 'Remaining demo group'
                : 'Your group'}
            </Heading>
            <Riders members={group.members} />
            <Copy small muted>
              {ride.status === 'CANCELLED'
                ? 'You left this trip. Remaining riders and their booking are retained in local demo state.'
                : pickupName(ride, group)}
            </Copy>
          </Card>
          <FareBreakdown group={group} />
        </>
      )}
      {isOpen(ride.status) && (
        <Button
          label="Resume current step"
          onPress={() => openRide(navigation, ride)}
        />
      )}
      {ride.status === 'COMPLETED' && (
        <Button
          label="View completion"
          onPress={() => navigation.navigate('Completed', { rideId: ride.id })}
        />
      )}
      <Button
        secondary
        label="Help & Safety"
        onPress={() => navigation.navigate('Help', { rideId: ride.id })}
      />
      {isOpen(ride.status) && (
        <Button secondary label="Cancel my participation" onPress={leave} />
      )}
    </Page>
  );
}
const styles = StyleSheet.create({
  bubble: {
    backgroundColor: c.surface,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    gap: 8,
    marginRight: 20,
  },
  ownBubble: {
    backgroundColor: c.surfaceMuted,
    marginRight: 0,
    marginLeft: 20,
  },
  systemBubble: {
    backgroundColor: c.background,
    marginRight: 0,
    borderWidth: 0,
  },
});
