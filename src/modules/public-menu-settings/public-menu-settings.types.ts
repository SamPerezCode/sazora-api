type PublicMenuSettingsProduct = Readonly<{
  id: string;
  name: string;
  imageUrl: string | null;
  currentPrice: string;
  isActive: boolean;
  isOperationallyAvailable: boolean;
  isPubliclyVisible: boolean;
  isPubliclyOrderable: boolean;
}>;

type PublicMenuSettingsCategory = Readonly<{
  id: string;
  name: string;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  isPubliclyVisible: boolean;
  products: PublicMenuSettingsProduct[];
}>;

type PublicMenuSettingsCatalog = Readonly<{
  categories: PublicMenuSettingsCategory[];
}>;

export type {
  PublicMenuSettingsCatalog,
  PublicMenuSettingsCategory,
  PublicMenuSettingsProduct,
};
