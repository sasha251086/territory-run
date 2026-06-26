/** Reverse geocode via OpenStreetMap Nominatim (best-effort, no API key). */
export async function reverseGeocodeLabel(
  lat: number,
  lng: number,
): Promise<string | null> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'json');
    url.searchParams.set('lat', lat.toFixed(6));
    url.searchParams.set('lon', lng.toFixed(6));
    url.searchParams.set('zoom', '14');
    url.searchParams.set('accept-language', 'ru');

    const response = await fetch(url.toString(), {
      headers: { 'User-Agent': 'TerritoryRun/1.0 (territory-run game)' },
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        suburb?: string;
        state?: string;
      };
    };

    const address = data.address;
    if (!address) {
      return null;
    }

    const locality =
      address.city || address.town || address.village || address.suburb || null;
    if (locality && address.state && locality !== address.state) {
      return `${locality}, ${address.state}`;
    }
    return locality || address.state || null;
  } catch {
    return null;
  }
}
