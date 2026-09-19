type RestaurantTable = Readonly<{
  id: string;
  businessId: string;
  code: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type CreateRestaurantTableData = Readonly<{
  code: string;
  name: string;
  capacity: number | null;
}>;
type UpdateRestaurantTableData = Readonly<{
  code: string;
  name: string;
  capacity: number | null;
}>;

export type {
  CreateRestaurantTableData,
  RestaurantTable,
  UpdateRestaurantTableData,
};
