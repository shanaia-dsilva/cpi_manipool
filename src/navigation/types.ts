import { NavigatorScreenParams } from '@react-navigation/native';
export type TabParams = {
  Home: undefined;
  Rides: undefined;
  Profile: undefined;
};
export type RootParams = {
  Welcome: undefined;
  Login: undefined;
  Setup: { email?: string } | undefined;
  Main: NavigatorScreenParams<TabParams> | undefined;
  CreateRide: undefined;
  LocationSearch: { field: 'pickupId' | 'destinationId'; savedOnly?: boolean };
  MapPreview: undefined;
  Matching: { rideId: string };
  Results: { rideId: string };
  MatchDetails: { rideId: string };
  GroupRide: { rideId: string };
  Chat: { rideId: string };
  ChooseRide: { rideId: string };
  ActiveRide: { rideId: string };
  Completed: { rideId: string };
  RideDetails: { rideId: string };
  Settings: undefined;
  ApiQuota: undefined;
  Help: { rideId?: string } | undefined;
};
