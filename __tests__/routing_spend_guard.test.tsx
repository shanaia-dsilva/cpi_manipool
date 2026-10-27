import React from 'react';
import TestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { InteractiveRouteMap } from '../src/components/InteractiveRouteMap';
import { configureGateway, setLiveRouting } from '../src/services/liveRouting';
import { locations } from '../src/data/fixtures';

test('live map mount and cancelled confirmation send zero requests; approval sends one', async () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest
    .fn()
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        sessionId: 'test-session',
        expiresAt: Date.now() + 60000,
      }),
    });
  globalThis.fetch = fetchMock;
  configureGateway('http://127.0.0.1:8787', 'private-test-token-24-characters');
  await setLiveRouting(true);
  fetchMock.mockClear();
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  const alert = jest.spyOn(Alert, 'alert');
  try {
    await TestRenderer.act(async () => {
      renderer = TestRenderer.create(
        <InteractiveRouteMap
          animated={false}
          pickup={locations[0]}
          destination={locations.find(p => p.id === 'airport')!}
        />,
      );
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const press = () =>
      renderer!.root
        .findAll(
          node =>
            node.props.accessibilityLabel ===
              'Fetch live route · up to 1 request' &&
            typeof node.props.onPress === 'function',
        )
        .at(-1)!
        .props.onPress();
    alert.mockImplementation((_title, _message, buttons) =>
      buttons?.[0].onPress?.(),
    );
    await TestRenderer.act(async () => {
      await press();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    alert.mockImplementation((_title, _message, buttons) =>
      buttons?.[1].onPress?.(),
    );
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        distanceKm: 24,
        durationMinutes: 30,
        encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
        summary: 'Test response',
      }),
    });
    await TestRenderer.act(async () => {
      await press();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    await TestRenderer.act(async () => renderer?.unmount());
    configureGateway(
      'http://127.0.0.1:8787',
      'private-test-token-24-characters',
    );
    alert.mockRestore();
    globalThis.fetch = originalFetch;
  }
});
