import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

type Payload = {
  type?: 'order' | 'bill';
  orderId?: string;
  billId?: string;
  url?: string;
};

function readPayload(response: Notifications.NotificationResponse): Payload {
  const raw = response.notification.request.content.data ?? {};
  return raw as Payload;
}

function routeFor(payload: Payload): string | null {
  if (payload.url) return payload.url;
  if (payload.type === 'order' && payload.orderId) return `/(customer)/orders/${payload.orderId}`;
  if (payload.type === 'bill' && payload.billId)
    return `/(customer)/profile/bills/${payload.billId}`;
  if (payload.orderId) return `/(customer)/orders/${payload.orderId}`;
  if (payload.billId) return `/(customer)/profile/bills/${payload.billId}`;
  return null;
}

/**
 * Routes notification taps to the matching screen.
 * Handles three entry points:
 *   1. App was killed: Notifications.getLastNotificationResponseAsync()
 *   2. App was backgrounded: addNotificationResponseReceivedListener
 *   3. App was foregrounded: same listener fires
 */
export function useNotificationNavigation(): void {
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!alive || !response) return;
        const target = routeFor(readPayload(response));
        if (target) router.replace(target as never);
      })
      .catch(() => undefined);

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = routeFor(readPayload(response));
      if (target) router.push(target as never);
    });

    return () => {
      alive = false;
      sub.remove();
    };
  }, [router]);
}
