import { Event } from '@/types/events';
import { getToken } from '@/shared/utils/auth';

const EVENTS_API_ENDPOINT =
  process.env.NEXT_PUBLIC_EVENTS_API_URL ||
  'https://miyosino-events.anorimura-miyosino.workers.dev';

interface EventsResponse {
  upcomingEvents: Event[];
  pastEvents: Event[];
}

export async function fetchEvents(): Promise<{
  upcomingEvents: Event[];
  pastEvents: Event[];
}> {
  const token = getToken();
  if (!token) {
    throw new Error('認証トークンがありません');
  }

  const url = new URL(`${EVENTS_API_ENDPOINT}/events`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
      }
      throw new Error('認証に失敗しました');
    }
    throw new Error(
      `イベントの取得に失敗しました: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as EventsResponse;

  const toDate = (event: Event): Event => ({
    ...event,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  });

  return {
    upcomingEvents: data.upcomingEvents.map(toDate),
    pastEvents: data.pastEvents.map(toDate),
  };
}
