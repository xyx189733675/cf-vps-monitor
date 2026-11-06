// Aggregates node  statistics from the public client list and the live snapshot.
// Mirrors frontend/src/utils/monitorView.ts getNodeStatsSummary, so GET /api/stats
// returns the same fields the dashboard derives locally.

export interface NodeStatsClient {
  uuid: string;
  region?: string | null;
}

export interface NodeStatsLiveRecord {
  net_total_up?: number | null;
  net_total_down?: number | null;
  net_out?: number | null;
  net_in?: number | null;
}

export interface NodeStats {
  onlineCount: number;
  totalCount: number;
  offlineCount: number;
  regionCount: number;
  totalUp: number;
  totalDown: number;
  totalSpeedUp: number;
  totalSpeedDown: number;
}

const UNKNOWN_REGION = /^(unknown|\u672a\u77e5|n\/a|null)$/i;

// Worker-side approximation of frontend resolveFlagCode: the frontend maps
// aliases through a large table that does not exist on the worker. Plain
// region values are normalised here instead; values with no country are dropped.
export function statsRegionKey(region: string | null | undefined): string | null {
  const raw = (region ?? '').trim();
  if (!raw || UNKNOWN_REGION.test(raw)) return null;
  const tail = raw.split(',').pop()?.trim() ?? '';
  if (/^[A-Za-z]{2}$/.test(tail)) return tail.toUpperCase();
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return raw;
}


function liveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function toLiveRecord(value: unknown): NodeStatsLiveRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  return {
    net_total_up: liveNumber(record.net_total_up),
    net_total_down: liveNumber(record.net_total_down),
    net_out: liveNumber(record.net_out),
    net_in: liveNumber(record.net_in),
  };
}

export function buildNodeStats(
  clients: readonly NodeStatsClient[],
  online: readonly string[],
  liveData: Readonly<Record<string, unknown>>,
): NodeStats {
  const onlineSet = new Set(online);
  const regionSet = new Set<string>();
  let onlineCount = 0;
  let totalUp = 0;
  let totalDown = 0;
  let totalSpeedUp = 0;
  let totalSpeedDown = 0;

  for (const client of clients) {
    if (!onlineSet.has(client.uuid)) continue;
    onlineCount += 1;
    const regionKey = statsRegionKey(client.region);
    if (regionKey) regionSet.add(regionKey);
    const record = toLiveRecord(liveData[client.uuid]);
    if (!record) continue;
    totalUp += record.net_total_up || 0;
    totalDown += record.net_total_down || 0;
    totalSpeedUp += record.net_out || 0;
    totalSpeedDown += record.net_in || 0;
  }

  return {
    onlineCount,
    totalCount: clients.length,
    offlineCount: clients.length - onlineCount,
    regionCount: regionSet.size,
    totalUp,
    totalDown,
    totalSpeedUp,
    totalSpeedDown,
  };
}
