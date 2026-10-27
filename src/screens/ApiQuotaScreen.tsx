import { confirmLiveRequest } from '../services/confirmLiveRequest';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, StyleSheet, Switch, TextInput, View } from 'react-native';
import {
  Button,
  Card,
  Copy,
  Heading,
  Notice,
  Page,
  Title,
} from '../components/ui';
import {
  configureGateway,
  expireLiveRouting,
  GatewayStatus,
  getGatewayStatus,
  liveRoutingActive,
  routingVersion,
  setLiveRouting,
  subscribeRouting,
} from '../services/liveRouting';
import { calculateRoute } from '../services/routing';
import { locations } from '../data/fixtures';

export function ApiQuotaScreen() {
  useSyncExternalStore(subscribeRouting, routingVersion);
  const [url, setUrl] = useState('http://127.0.0.1:8787');
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState<GatewayStatus>();
  const [message, setMessage] = useState(
    'Demo results are local estimates. No mapping service is contacted while live mode is off.',
  );
  const [updatedAt, setUpdatedAt] = useState<number>();
  const [busy, setBusy] = useState(false);
  const active = liveRoutingActive();
  useEffect(() => {
    if (!connected) return;
    let mounted = true;
    const timer = setInterval(() => {
      expireLiveRouting();
      getGatewayStatus()
        .then(value => {
          if (mounted) {
            setStatus(value);
            setUpdatedAt(Date.now());
          }
        })
        .catch(() => {
          if (mounted) {
            setStatus(undefined);
            setMessage(
              'Gateway unreachable. Usage status unavailable; retry connection.',
            );
          }
        });
    }, 5000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [connected]);
  const act = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connection failed.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page back>
      <Title>Routing & API status</Title>
      <Card>
        <Heading>
          {active ? 'Live Google routing ON' : 'Demo results · Google OFF'}
        </Heading>
        <Copy>
          Faculty use only. Live sessions expire after 15 minutes. Google
          credentials stay on the local server.
        </Copy>
        <Switch
          accessibilityLabel="Enable live Google routing"
          value={active}
          disabled={busy || !connected}
          onValueChange={enabled =>
            act(async () => {
              setStatus(await setLiveRouting(enabled));
              setMessage(
                enabled
                  ? 'Live routing armed. Turning ON does not call Google. Each live action asks for confirmation.'
                  : 'Google OFF. Local demo estimates enabled.',
              );
            })
          }
        />
      </Card>
      <Heading>Connect demo gateway</Heading>
      <TextInput
        accessibilityLabel="Demo gateway URL"
        placeholder="Gateway URL"
        value={url}
        onChangeText={setUrl}
        autoCapitalize="none"
        editable={!active}
      />
      <TextInput
        accessibilityLabel="Demo access token"
        placeholder="Private demo access token"
        value={token}
        onChangeText={setToken}
        autoCapitalize="none"
        secureTextEntry
        editable={!active}
      />
      <Button
        label="Connect / refresh status"
        disabled={busy || active}
        onPress={() =>
          act(async () => {
            configureGateway(url, token);
            setStatus(await getGatewayStatus());
            setUpdatedAt(Date.now());
            setConnected(true);
            setMessage('Gateway connected. Toggle live routing on when ready.');
          })
        }
      />
      <Notice>{message}</Notice>
      <Card>
        <Heading>Google bill: not connected</Heading>
        <Copy>
          The ₹15,000 autopay authorisation is not this app's spending limit.
          This app limits requests, not your bank mandate or all activity on
          your Google account.
        </Copy>
        <Copy small>
          No live rupee balance or free-credit balance is available here. Do not
          interpret unused requests as free requests. Set Google Cloud API
          quotas as well; alerts-only budgets do not stop spending.
        </Copy>
        <Button
          secondary
          label="Open Google Cloud billing"
          onPress={() =>
            Linking.openURL('https://console.cloud.google.com/billing').catch(
              () => setMessage('Open Google Cloud billing in your browser.'),
            )
          }
        />
      </Card>
      {!status && (
        <Notice>
          Usage unknown until connected. Default gateway caps: 30
          requests/session, 50/day, 100 overall, 10/minute. Live sessions expire
          after 15 minutes. These are request caps, not free allowances.
        </Notice>
      )}
      {status && (
        <Card>
          <Heading>
            {status.configured
              ? 'Google key configured on server'
              : 'Google key missing on server'}
          </Heading>
          <Copy>
            Server session: {status.active ? 'ON' : 'OFF'} · This app:{' '}
            {active ? 'ON' : 'OFF'}
          </Copy>
          <Heading>
            {Math.min(
              status.limits.total - status.total,
              status.limits.daily - status.daily,
              status.limits.session - status.session,
            ) <= 0
              ? 'STOP · request allowance exhausted'
              : active
              ? 'Ready · confirmation required for each action'
              : 'This app OFF · no new Google requests'}
          </Heading>
          {[
            {
              label: 'This session',
              used: status.session,
              limit: status.limits.session,
            },
            {
              label: `Today · ${status.day} (India)`,
              used: status.daily,
              limit: status.limits.daily,
            },
            {
              label: 'Overall · survives restarts',
              used: status.total,
              limit: status.limits.total,
            },
          ].map(item => (
            <View key={item.label} style={styles.meter}>
              <Heading>{item.label}</Heading>
              <Copy>
                {Math.max(0, item.limit - item.used)} requests left ·{' '}
                {item.used} of {item.limit} used
              </Copy>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={item.label}
                accessibilityValue={{ min: 0, max: item.limit, now: item.used }}
                style={styles.track}
              >
                <View
                  style={[
                    styles.fill,
                    item.used >= item.limit
                      ? styles.exhausted
                      : item.used >= item.limit * 0.8
                      ? styles.warning
                      : styles.available,
                    {
                      width: `${Math.min(
                        100,
                        (item.used / item.limit) * 100,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
          <Copy>
            Rate limit: {status.limits.perMinute} requests/minute. At the rate
            limit, wait one minute before retrying.
          </Copy>
          <Copy small>
            Status refreshed:{' '}
            {updatedAt
              ? new Date(updatedAt).toLocaleTimeString()
              : 'Just connected'}
            . Refresh checks your local gateway only and uses zero Google
            requests.
          </Copy>
          <Copy>
            Expires:{' '}
            {status.expiresAt
              ? new Date(status.expiresAt).toLocaleTimeString()
              : 'OFF'}
          </Copy>
          <Copy>Last attempt: {status.lastAttempt || 'None'}</Copy>
          <Copy small>
            Counts include failed requests and survive server/app restarts.
            These are this gateway's limits, not Google billing totals or
            free-tier allowances. Maps SDK and Places requests are disabled.
            Verify project quotas and billing in Google Cloud.
          </Copy>
        </Card>
      )}
      <Button
        label={
          busy
            ? 'Checking…'
            : active
            ? 'Fetch real campus → airport · up to 1 request'
            : 'Test local demo route'
        }
        disabled={busy}
        onPress={() =>
          act(async () => {
            if (active && !(await confirmLiveRequest(1))) return;
            const result = await calculateRoute([
              locations.find(p => p.id === 'campus')!,
              locations.find(p => p.id === 'airport')!,
            ]);
            setMessage(
              result.status === 'failed'
                ? result.error!
                : `${
                    result.provider === 'google'
                      ? 'Real Google response'
                      : 'Demo estimate'
                  }: ${result.distanceKm.toFixed(1)} km, ${Math.round(
                    result.durationMinutes,
                  )} min. ${result.summary}`,
            );
            if (connected) setStatus(await getGatewayStatus());
            setUpdatedAt(Date.now());
          })
        }
      />
      <Copy small>
        Live failures never masquerade as successful routes. Switch OFF to use
        demo estimates, or change locations and retry. There is no usage reset
        button.
      </Copy>
    </Page>
  );
}

const styles = StyleSheet.create({
  exhausted: { backgroundColor: '#B42318' },
  warning: { backgroundColor: '#B54708' },
  available: { backgroundColor: '#166534' },
  meter: { gap: 6, marginVertical: 8 },
  track: {
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  fill: { height: 12, borderRadius: 6 },
});
