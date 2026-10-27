import { Alert } from 'react-native';

// Every user-facing paid operation discloses its maximum request count.
export function confirmLiveRequest(maxRequests: number): Promise<boolean> {
  return new Promise(resolve => {
    Alert.alert(
      'Use Google request allowance?',
      `This action can send up to ${maxRequests} Google Routes request${
        maxRequests === 1 ? '' : 's'
      }. Requests may be billed and failed attempts also count. Cancel sends none.`,
      [
        {
          text: 'Cancel · no requests',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        { text: `Allow up to ${maxRequests}`, onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}
