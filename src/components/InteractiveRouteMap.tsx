import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { Coordinate, Location, PickupArrangement, RouteGeometry } from '../types/domain';
import { colors as c } from '../theme';
import { Badge, Copy, Row } from './ui';
import { calculateRoute, computeOfflineRoute } from '../services/routing';
import { isDemoModeActive } from '../services/apiQuota';
import { useApp } from '../state/AppContext';

export interface InteractiveRouteMapProps {
  pickup: Location;
  destination: Location;
  waypoints?: Coordinate[];
  arrangement?: PickupArrangement;
  compact?: boolean;
  animated?: boolean;
  onRetry?: () => void;
}

export function InteractiveRouteMap({
  pickup,
  destination,
  waypoints,
  arrangement,
  compact = false,
  animated = true,
  onRetry,
}: InteractiveRouteMapProps) {
  const { state, dispatch } = useApp();
  const [route, setRoute] = useState<RouteGeometry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoActive = isDemoModeActive(state.apiQuota);
  const pulse = useRef(new Animated.Value(1)).current;

  // Pulse animation for active route/pickups
  useEffect(() => {
    if (!animated) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [animated, pulse]);

  // Load road route
  const fetchRoute = useCallback(async () => {
    if (!pickup.coordinate || !destination.coordinate) {
      setRoute(null);
      setError('Coordinates unavailable for this landmark.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build points list
      const points: Coordinate[] = [pickup.coordinate];
      if (waypoints && waypoints.length > 0) {
        points.push(...waypoints);
      }
      points.push(destination.coordinate);

      // Record quota call
      dispatch({
        type: 'RECORD_API_CALL',
        callType: demoActive ? 'directions' : 'osrm',
      });

      const res = await calculateRoute(points, {
        useGoogleDemo: demoActive,
        timeoutMs: 3500,
      });

      setRoute(res);
      if (res.status === 'failed') {
        setError(res.error ?? 'Unable to calculate road route.');
      }
    } catch {
      // Seamlessly fall back
      const fallback = computeOfflineRoute(
        [pickup.coordinate, ...(waypoints || []), destination.coordinate],
      );
      setRoute(fallback);
      dispatch({ type: 'RECORD_API_CALL', callType: 'offline' });
    } finally {
      setLoading(false);
    }
  }, [
    pickup.coordinate,
    destination.coordinate,
    waypoints,
    demoActive,
    dispatch,
  ]);

  useEffect(() => {
    fetchRoute();
  }, [fetchRoute]);

  // Map coordinate bounding box projection to SVG viewBox (340 x 180)
  const mapWidth = 340;
  const mapHeight = compact ? 130 : 190;
  const padding = 32;

  const projection = useMemo(() => {
    const coords: Coordinate[] = [];
    if (pickup.coordinate) coords.push(pickup.coordinate);
    if (waypoints) coords.push(...waypoints);
    if (destination.coordinate) coords.push(destination.coordinate);
    if (route && route.coordinates.length > 0) {
      coords.push(...route.coordinates);
    }

    if (coords.length < 2) {
      return null;
    }

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    for (const pt of coords) {
      if (pt.latitude < minLat) minLat = pt.latitude;
      if (pt.latitude > maxLat) maxLat = pt.latitude;
      if (pt.longitude < minLng) minLng = pt.longitude;
      if (pt.longitude > maxLng) maxLng = pt.longitude;
    }

    // Ensure non-zero delta
    const latSpan = Math.max(0.02, maxLat - minLat);
    const lngSpan = Math.max(0.02, maxLng - minLng);

    const project = (coord: Coordinate) => {
      // SVG Y is inverted (latitude goes up, SVG Y goes down)
      const x =
        padding +
        ((coord.longitude - minLng) / lngSpan) * (mapWidth - padding * 2);
      const y =
        mapHeight -
        padding -
        ((coord.latitude - minLat) / latSpan) * (mapHeight - padding * 2);
      return {
        x: Math.round(Math.max(padding, Math.min(mapWidth - padding, x))),
        y: Math.round(Math.max(padding, Math.min(mapHeight - padding, y))),
      };
    };

    return { project, minLat, maxLat, minLng, maxLng };
  }, [pickup.coordinate, destination.coordinate, waypoints, route, mapHeight]);

  // Build SVG path string from route polyline coordinates
  const svgPathData = useMemo(() => {
    if (!projection) return '';
    const points =
      route && route.coordinates.length > 0
        ? route.coordinates
        : [pickup.coordinate!, destination.coordinate!];

    const projected = points.map(projection.project);
    if (projected.length === 0) return '';

    return projected.reduce((acc, pt, i) => {
      if (i === 0) return `M ${pt.x} ${pt.y}`;
      return `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [projection, route, pickup.coordinate, destination.coordinate]);

  const startPt = pickup.coordinate && projection ? projection.project(pickup.coordinate) : null;
  const endPt =
    destination.coordinate && projection ? projection.project(destination.coordinate) : null;

  return (
    <View
      style={styles.card}
      accessibilityLabel={`Route map from ${pickup.name} to ${destination.name}`}
    >
      {/* Provider indicator badge */}
      <View style={styles.headerRow}>
        {demoActive ? (
          <Badge>Google Maps Demo Active</Badge>
        ) : route?.provider === 'osrm' ? (
          <Badge>OSRM Road Network</Badge>
        ) : (
          <Badge>Offline Bengaluru Topology</Badge>
        )}
        {loading && <ActivityIndicator size="small" color={c.primary} />}
      </View>

      {/* SVG Canvas Map */}
      <View style={[styles.canvasContainer, { height: mapHeight }]}>
        <Svg width="100%" height={mapHeight} viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
          {/* Background & Road Grid Pattern */}
          <Rect width={mapWidth} height={mapHeight} fill="#F9F6F0" rx={12} />
          <Line x1={0} y1={mapHeight * 0.3} x2={mapWidth} y2={mapHeight * 0.3} stroke="#EBE4D8" strokeWidth={3} />
          <Line x1={0} y1={mapHeight * 0.7} x2={mapWidth} y2={mapHeight * 0.7} stroke="#EBE4D8" strokeWidth={3} />
          <Line x1={mapWidth * 0.25} y1={0} x2={mapWidth * 0.25} y2={mapHeight} stroke="#EBE4D8" strokeWidth={3} />
          <Line x1={mapWidth * 0.75} y1={0} x2={mapWidth * 0.75} y2={mapHeight} stroke="#EBE4D8" strokeWidth={3} />

          {/* Polyline Route Casing (shadow) */}
          {svgPathData ? (
            <Path
              d={svgPathData}
              stroke="#D2B48C"
              strokeWidth={8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}

          {/* Polyline Active Road Route */}
          {svgPathData ? (
            <Path
              d={svgPathData}
              stroke={demoActive ? '#1A73E8' : c.primary}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          ) : null}

          {/* Intermediate Waypoints (e.g. Sequential stops or Meeting point) */}
          {waypoints &&
            projection &&
            waypoints.map((wp, index) => {
              const pt = projection.project(wp);
              return (
                <React.Fragment key={`wp-${index}`}>
                  <Circle cx={pt.x} cy={pt.y} r={9} fill={c.surface} stroke={c.primary} strokeWidth={2.5} />
                  <SvgText
                    x={pt.x}
                    y={pt.y + 4}
                    fontSize={10}
                    fontWeight="bold"
                    fill={c.primary}
                    textAnchor="middle"
                  >
                    {index + 2}
                  </SvgText>
                </React.Fragment>
              );
            })}

          {/* Start Point Marker (Pickup or Meeting point) */}
          {startPt && (
            <>
              <Circle cx={startPt.x} cy={startPt.y} r={11} fill={c.surface} stroke={c.accent} strokeWidth={3} />
              <Circle cx={startPt.x} cy={startPt.y} r={5} fill={c.accent} />
              <SvgText
                x={startPt.x}
                y={startPt.y - 14}
                fontSize={10}
                fontWeight="600"
                fill={c.text}
                textAnchor="middle"
              >
                1. Pickup
              </SvgText>
            </>
          )}

          {/* Destination Marker */}
          {endPt && (
            <>
              <Circle cx={endPt.x} cy={endPt.y} r={12} fill={c.primaryDark} stroke={c.surface} strokeWidth={2.5} />
              <Circle cx={endPt.x} cy={endPt.y} r={4} fill={c.surface} />
              <SvgText
                x={endPt.x}
                y={endPt.y - 15}
                fontSize={10}
                fontWeight="600"
                fill={c.text}
                textAnchor="middle"
              >
                Destination
              </SvgText>
            </>
          )}
        </Svg>
      </View>

      {/* Failure Handling & Recovery Banner */}
      {error && (
        <View style={styles.errorBox}>
          <Copy small style={styles.errorText}>
            Route service notice: {error}
          </Copy>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              fetchRoute();
              onRetry?.();
            }}
          >
            <Copy small style={styles.retryButtonText}>
              Retry Route
            </Copy>
          </TouchableOpacity>
        </View>
      )}

      {/* Metrics Bar */}
      {route && (
        <View style={styles.metricsBar}>
          <Row>
            <View style={styles.metricItem}>
              <Copy small muted>
                Distance
              </Copy>
              <Copy style={styles.metricValue}>{route.distanceKm} km</Copy>
            </View>
            <View style={styles.metricItem}>
              <Copy small muted>
                Est. Time
              </Copy>
              <Copy style={styles.metricValue}>~{route.durationMinutes} min</Copy>
            </View>
            {arrangement && (
              <View style={styles.metricItem}>
                <Copy small muted>
                  Arrangement
                </Copy>
                <Copy style={styles.metricValue}>
                  {arrangement.mode === 'common' ? 'Meeting Point' : 'Sequential'}
                </Copy>
              </View>
            )}
          </Row>
          <Copy small muted style={styles.routeSummaryText}>
            {route.summary}
          </Copy>
        </View>
      )}

      {/* Attribution Note */}
      <View style={styles.attributionRow}>
        <Copy small muted style={styles.attributionText}>
          {demoActive
            ? 'Map data © Google Maps Platform · Gated Demo'
            : 'Map data © OpenStreetMap contributors · OSRM Road Router'}
        </Copy>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    padding: 12,
    gap: 8,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  canvasContainer: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  errorBox: {
    backgroundColor: '#FFF1F0',
    borderWidth: 1,
    borderColor: '#FFA39E',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: {
    color: '#CF1322',
    flex: 1,
  },
  retryButton: {
    backgroundColor: c.primary,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: c.surface,
    fontWeight: '600',
  },
  metricsBar: {
    backgroundColor: c.background,
    borderRadius: 10,
    padding: 8,
    gap: 4,
  },
  metricItem: {
    flex: 1,
  },
  metricValue: {
    fontWeight: '700',
    color: c.text,
  },
  routeSummaryText: {
    marginTop: 2,
    fontStyle: 'italic',
  },
  attributionRow: {
    alignItems: 'center',
    paddingTop: 2,
  },
  attributionText: {
    fontSize: 10,
  },
});
