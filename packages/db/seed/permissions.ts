const crud = (r: string) => [`${r}:read`, `${r}:write`];

export const ROLES: Record<string, string[]> = {
  Owner: ["*"],
  "Catalog Manager": [...crud("category"), ...crud("attribute"), ...crud("product"), ...crud("media"), ...crud("page")],
  "Inventory Manager": ["product:read", ...crud("inventory"), ...crud("warehouse")],
  "Order Manager": ["product:read", "customer:read", ...crud("order"), "order:refund", ...crud("shipment"), ...crud("return")],
  "Support Agent": ["product:read", "order:read", "customer:read", "customer:reveal", ...crud("return"), ...crud("review")],
  Marketing: ["product:read", ...crud("coupon"), ...crud("milestone"), ...crud("banner"), ...crud("page"), ...crud("lead")],
  Analyst: ["report:read", "order:read", "product:read"],
};
