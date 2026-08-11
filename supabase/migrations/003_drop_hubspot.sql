-- Entfernt die HubSpot-Integration aus dem Schema.
alter table public.customers drop column if exists hubspot_id;
