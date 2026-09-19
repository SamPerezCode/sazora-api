type Category = Readonly<{
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type CreateCategoryData = Readonly<{
  name: string;
  description: string | null;
  displayOrder: number;
}>;

type UpdateCategoryData = Readonly<{
  name: string;
  description: string | null;
  displayOrder: number;
}>;

export type { Category, CreateCategoryData, UpdateCategoryData };

/*
representa una categoría recuperada desde MySQL.
*/
