import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import {
  Clock,
  Shield,
  Zap,
} from 'lucide-react-native';
import {
  Badge,
  Button,
  Card,
  Copy,
  Heading,
  Kicker,
  Notice,
  Page,
  Row,
  Title,
  ui,
} from '../components/ui';
import { colors as c } from '../theme';
import { useApp } from '../state/AppContext';
import {
  GOOGLE_QUOTA_LIMITS,
  MAPPING_PROVIDERS_EVALUATION,
  getQuotaGauges,
  isDemoModeActive,
} from '../services/apiQuota';
import { calculateRoute } from '../services/routing';
import { locations } from '../data/fixtures';

export function ApiQuotaScreen() {
  const { state, dispatch } = useApp();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const quota = state.apiQuota;
  const demoActive = isDemoModeActive(quota);
  const gauges = getQuotaGauges(quota);

  // Toggle demo mode with safety confirmation
  const handleToggleDemoMode = (enable: boolean) => {
    if (enable) {
      Alert.alert(
        'Turn on Google Maps for Presentation?',
        'This enables live Google Maps Platform calls. Keep it OFF during normal development to strictly prevent team members from exceeding your Google API quota.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn On for Demo',
            onPress: () => {
              dispatch({
                type: 'SET_DEMO_MODE',
                enabled: true,
                timeoutMinutes: quota.autoTimeoutMinutes,
              });
            },
          },
        ],
      );
    } else {
      dispatch({ type: 'SET_DEMO_MODE', enabled: false });
    }
  };

  // Run safe test call to verify active router
  const runTestCall = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const from = locations[0]; // Campus
      const to = locations[3]; // Airport
      const res = await calculateRoute([from, to], {
        useGoogleDemo: demoActive,
        timeoutMs: 3000,
      });

      dispatch({
        type: 'RECORD_API_CALL',
        callType: demoActive ? 'directions' : 'osrm',
      });

      setTestResult(
        `✓ Route computed successfully: ${res.distanceKm} km in ${res.durationMinutes} min via ${res.provider.toUpperCase()} (${res.summary})`,
      );
    } catch {
      setTestResult('⚠️ Test call failed. Offline fallback active.');
    } finally {
      setTesting(false);
    }
  };

  // Reset counters
  const handleResetCounters = () => {
    Alert.alert(
      'Reset API Usage Counters?',
      'This clears local recorded call counts. Your active mode setting remains unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Counters',
          style: 'destructive',
          onPress: () => dispatch({ type: 'RESET_API_QUOTA' }),
        },
      ],
    );
  };

  return (
    <Page back>
      <Kicker>Routing & API Governance</Kicker>
      <Title>API Limits &{'\n'}Demo Controls</Title>
      <Copy muted>
        Designed for Shanaia to prevent accidental Google Maps API usage and
        safely demonstrate live routing during faculty presentation.
      </Copy>

      {/* Active Mode Status Card */}
      <View
        style={[
          styles.statusCard,
          demoActive ? styles.statusCardActive : styles.statusCardSafe,
        ]}
      >
        <Row>
          {demoActive ? (
            <Zap color={c.accent} size={28} />
          ) : (
            <Shield color="#388E3C" size={28} />
          )}
          <View style={ui.flex}>
            <Heading>
              {demoActive
                ? 'Faculty Demo Mode (GMaps Active)'
                : 'Safe Open-Source Mode (OSRM Active)'}
            </Heading>
            <Copy small muted>
              {demoActive
                ? 'Google Maps Platform calls enabled for your presentation.'
                : 'Default safe mode. Zero Google API quota consumed.'}
            </Copy>
          </View>
        </Row>

        <View style={styles.toggleRow}>
          <View style={ui.flex}>
            <Heading>Google Maps Demo Switch</Heading>
            <Copy small muted>
              Turn on only when presenting to faculty alone
            </Copy>
          </View>
          <Switch
            value={demoActive}
            onValueChange={handleToggleDemoMode}
            trackColor={{ false: c.border, true: c.primary }}
            thumbColor={c.surface}
          />
        </View>

        {demoActive && quota.demoModeExpiresAt && (
          <View style={styles.timerBox}>
            <Clock size={16} color={c.accent} />
            <Copy small style={styles.timerText}>
              Auto-safety timeout active: reverts to safe mode at{' '}
              {new Date(quota.demoModeExpiresAt).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Copy>
          </View>
        )}
      </View>

      {/* Quota Usage Dashboard */}
      <Heading>Google Cloud Monthly Allowance</Heading>
      <Card>
        <Row>
          <View style={ui.flex}>
            <Copy small muted>
              Estimated Cost
            </Copy>
            <Heading>₹{gauges.estimatedCostInr}.00</Heading>
          </View>
          <View style={ui.flex}>
            <Copy small muted>
              Remaining Free Credit
            </Copy>
            <Heading>
              ₹{gauges.creditRemainingInr}.00
            </Heading>
          </View>
          <Badge>
            {gauges.isWithinFreeTier ? '100% Free Tier' : 'Over Limit'}
          </Badge>
        </Row>

        {/* Maps SDK Gauge */}
        <View style={styles.gaugeContainer}>
          <Row>
            <Copy small>Maps SDK Loads</Copy>
            <Copy small style={styles.gaugeCounter}>
              {quota.googleMapsLoads} / {GOOGLE_QUOTA_LIMITS.mapsLoads.toLocaleString()}
            </Copy>
          </Row>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                // eslint-disable-next-line react-native/no-inline-styles
                {
                  width: `${Math.max(2, gauges.mapsPct)}%`,
                  backgroundColor: gauges.mapsPct > 80 ? '#D32F2F' : c.primary,
                },
              ]}
            />
          </View>
        </View>

        {/* Places Autocomplete Gauge */}
        <View style={styles.gaugeContainer}>
          <Row>
            <Copy small>Places Autocomplete</Copy>
            <Copy small style={styles.gaugeCounter}>
              {quota.googlePlacesAutocomplete} /{' '}
              {GOOGLE_QUOTA_LIMITS.placesAutocomplete.toLocaleString()}
            </Copy>
          </Row>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                // eslint-disable-next-line react-native/no-inline-styles
                {
                  width: `${Math.max(2, gauges.placesPct)}%`,
                  backgroundColor:
                    gauges.placesPct > 80 ? '#D32F2F' : c.accent,
                },
              ]}
            />
          </View>
        </View>

        {/* Directions / Routing API Gauge */}
        <View style={styles.gaugeContainer}>
          <Row>
            <Copy small>Directions / Routes API</Copy>
            <Copy small style={styles.gaugeCounter}>
              {quota.googleDirectionsRequests} /{' '}
              {GOOGLE_QUOTA_LIMITS.directionsRequests.toLocaleString()}
            </Copy>
          </Row>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                // eslint-disable-next-line react-native/no-inline-styles
                {
                  width: `${Math.max(2, gauges.directionsPct)}%`,
                  backgroundColor:
                    gauges.directionsPct > 80 ? '#D32F2F' : '#1976D2',
                },
              ]}
            />
          </View>
        </View>

        <Copy small muted>
          Total recorded Google API requests: {gauges.totalGoogleCalls}
        </Copy>
      </Card>

      {/* Open-Source Engine Activity */}
      <Heading>Open-Source & Offline Activity</Heading>
      <Card>
        <Row>
          <View style={ui.flex}>
            <Copy small muted>
              OSRM Driving Routes
            </Copy>
            <Heading>{quota.osrmRouteRequests} calls</Heading>
            <Copy small muted>
              router.project-osrm.org · Free
            </Copy>
          </View>
          <View style={ui.flex}>
            <Copy small muted>
              Offline Graph Fallbacks
            </Copy>
            <Heading>{quota.offlineFallbackRequests} calls</Heading>
            <Copy small muted>
              Bengaluru Topology · 0 net
            </Copy>
          </View>
        </Row>
        <Copy small muted>
          Last call provider:{' '}
          <Copy small style={styles.providerName}>
            {quota.lastCallProvider || 'None'}
          </Copy>
        </Copy>
      </Card>

      {/* Action Buttons */}
      <Button
        label={testing ? 'Testing...' : 'Simulate Test Route Call'}
        disabled={testing}
        onPress={runTestCall}
      />
      {testResult && <Notice>{testResult}</Notice>}

      <Button
        secondary
        label="Reset Usage Counters"
        onPress={handleResetCounters}
      />

      {/* Mapping Approach Evaluation Table (Task 1) */}
      <Heading>Mapping & Routing Evaluation</Heading>
      <Copy muted>
        Comparison of mapping, place search, and routing services evaluated for
        the MAHE Carpool prototype:
      </Copy>

      {MAPPING_PROVIDERS_EVALUATION.map(item => (
        <Card key={item.id}>
          <Row>
            <Heading>{item.name}</Heading>
            <Badge>{item.status}</Badge>
          </Row>
          <Copy small>
            <Copy small style={styles.evalLabel}>
              Role:{' '}
            </Copy>
            {item.role}
          </Copy>
          <Copy small>
            <Copy small style={styles.evalLabel}>
              Local Bengaluru Coverage:{' '}
            </Copy>
            {item.localCoverage}
          </Copy>
          <Copy small>
            <Copy small style={styles.evalLabel}>
              Hosting / Infrastructure:{' '}
            </Copy>
            {item.hosting}
          </Copy>
          <Copy small>
            <Copy small style={styles.evalLabel}>
              Free Tier Limits:{' '}
            </Copy>
            {item.freeLimits}
          </Copy>
          <Copy small>
            <Copy small style={styles.evalLabel}>
              Cost Structure:{' '}
            </Copy>
            {item.cost}
          </Copy>
          <Copy small>
            <Copy small style={styles.evalLabel}>
              Attribution Requirement:{' '}
            </Copy>
            {item.attribution}
          </Copy>
        </Card>
      ))}
    </Page>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    borderWidth: 2,
    gap: 12,
  },
  statusCardSafe: {
    borderColor: '#81C784',
    backgroundColor: '#F1F8E9',
  },
  statusCardActive: {
    borderColor: c.accent,
    backgroundColor: '#FFF8E1',
  },
  safeTitle: {
    color: '#2E7D32',
  },
  activeTitle: {
    color: '#E65100',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFE082',
    padding: 8,
    borderRadius: 8,
  },
  timerText: {
    color: '#795548',
    fontWeight: '600',
    flex: 1,
  },
  gaugeContainer: {
    marginVertical: 4,
    gap: 4,
  },
  gaugeCounter: {
    fontWeight: '600',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: c.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  evalLabel: {
    fontWeight: '700',
    color: c.text,
  },
  providerName: {
    fontWeight: '600',
  },
});
