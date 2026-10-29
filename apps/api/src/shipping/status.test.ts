import { expect, it } from "vitest";
import { mapStatus } from "./status";

it("maps courier wording to our shipment statuses", () => {
  expect(mapStatus("Out For Delivery")).toBe("OFD");
  expect(mapStatus("DELIVERED")).toBe("DELIVERED");
  expect(mapStatus("Undelivered - customer not available")).toBeNull();
  expect(mapStatus("RTO Initiated")).toBe("RTO");
  expect(mapStatus("RTO Delivered")).toBe("RTO"); // returned to us, never "delivered to customer"
  expect(mapStatus("Pickup Done")).toBe("PICKED_UP");
  expect(mapStatus("In Transit")).toBe("IN_TRANSIT");
  expect(mapStatus("Something new")).toBeNull();
});
