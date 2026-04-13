const HUBSPOT_BASE = "https://api.hubapi.com";

interface HubSpotContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    company?: string;
  };
}

interface HubSpotContactsResponse {
  results: HubSpotContact[];
  paging?: { next?: { after: string } };
}

export async function fetchHubSpotContacts(
  after?: string
): Promise<HubSpotContactsResponse> {
  const params = new URLSearchParams({
    limit: "100",
    properties: "firstname,lastname,email,phone,company",
  });
  if (after) params.set("after", after);

  const res = await fetch(
    `${HUBSPOT_BASE}/crm/v3/objects/contacts?${params}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${error}`);
  }

  return res.json();
}

export function mapContactToCustomer(contact: HubSpotContact) {
  const { firstname = "", lastname = "", email, phone, company } =
    contact.properties;
  return {
    name: [firstname, lastname].filter(Boolean).join(" ") || "Unbekannt",
    email: email ?? null,
    phone: phone ?? null,
    company: company ?? null,
    hubspot_id: contact.id,
  };
}
