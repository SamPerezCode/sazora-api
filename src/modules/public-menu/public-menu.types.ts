type PublicBusinessProfile = Readonly<{
  name: string;
  slug: string;
  timezone: string;
  currencyCode: string;
  tagline: string | null;
  phone: string | null;
  address: string | null;
  openingHoursText: string | null;
  instagram: string | null;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  publicMenuDescription: string | null;
  publicOrderingEnabled: boolean;
}>;

type PublicMenuProduct = Readonly<{
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  isOrderable: boolean;
}>;

type PublicMenuCategory = Readonly<{
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  products: PublicMenuProduct[];
}>;

type PublicMenu = Readonly<{
  business: PublicBusinessProfile;
  categories: PublicMenuCategory[];
}>;

export type {
  PublicBusinessProfile,
  PublicMenu,
  PublicMenuCategory,
  PublicMenuProduct,
};
