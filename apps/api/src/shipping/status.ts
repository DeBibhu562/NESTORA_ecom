export type ShipStatus = "PICKED_UP" | "IN_TRANSIT" | "OFD" | "DELIVERED" | "RTO";

/** Maps a courier's free-text status to ours. Unknown text returns null (still stored on the timeline, never changes the status). */
export function mapStatus(text: string): ShipStatus | null {
  const t = text.toUpperCase().replace(/[_-]/g, " ");
  if (/RTO/.test(t)) return "RTO";
  if (/OUT FOR DELIVERY/.test(t)) return "OFD";
  if (/DELIVERED/.test(t) && !/UNDELIVERED|NOT DELIVERED/.test(t)) return "DELIVERED";
  if (/PICKED UP|PICKUP DONE|PICKUP COMPLETE/.test(t)) return "PICKED_UP";
  if (/IN TRANSIT|SHIPPED|REACHED|DISPATCH|ARRIVED/.test(t)) return "IN_TRANSIT";
  return null;
}
