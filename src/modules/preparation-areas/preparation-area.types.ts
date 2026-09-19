type PreparationArea = Readonly<{
  id: string;
  businessId: string;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}>;

type CreatePreparationAreaData = Readonly<{
  name: string;
  description: string | null;
  displayOrder: number;
}>;

type UpdatePreparationAreaData = Readonly<{
  name: string;
  description: string | null;
  displayOrder: number;
}>;

export type {
  CreatePreparationAreaData,
  PreparationArea,
  UpdatePreparationAreaData,
};
