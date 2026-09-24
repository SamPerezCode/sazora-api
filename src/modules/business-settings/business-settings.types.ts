type BusinessSettings = Readonly<{
  businessId: string;
  name: string;
  slug: string;
  timezone: string;
  currencyCode: string;
  tagline: string | null;
  phone: string | null;
  address: string | null;
  openingHoursText: string | null;
  instagram: string | null;
  taxId: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  kitchenTicketFooter: string | null;
  publicMenuDescription: string | null;
  publicMenuEnabled: boolean;
  publicOrderingEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type UpdateBusinessSettingsData = Readonly<{
  name: string;
  tagline: string | null;
  phone: string | null;
  address: string | null;
  openingHoursText: string | null;
  instagram: string | null;
  taxId: string | null;
  primaryColor: string;
  accentColor: string;
  kitchenTicketFooter: string | null;
  publicMenuDescription: string | null;
  publicMenuEnabled: boolean;
  publicOrderingEnabled: boolean;
}>;

export type { BusinessSettings, UpdateBusinessSettingsData };
