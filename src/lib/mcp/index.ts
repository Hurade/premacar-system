import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listContacts from "./tools/list-contacts";
import listDeals from "./tools/list-deals";
import listCampaigns from "./tools/list-campaigns";
import whoami from "./tools/whoami";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "premacar-mcp",
  title: "PremaCar MCP",
  version: "0.1.0",
  instructions:
    "PremaCar tools for a signed-in user. Use `list_contacts`, `list_deals`, and `list_campaigns` to read the user's CRM data, and `whoami` to verify the current identity.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listContacts, listDeals, listCampaigns, whoami],
});
