type RestaurantTableLocation = Readonly<{
  id: string;
  code: string;
  name: string;
  locationType: "POINT_OF_SALE";
  isActive: boolean;
}>;

type RestaurantTable = Readonly<{
  id: string;
  businessId: string;
  locationId: string;
  location: RestaurantTableLocation;
  code: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type CreateRestaurantTableData = Readonly<{
  locationId: string;
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
  RestaurantTableLocation,
  UpdateRestaurantTableData,
};
