import type { LocationType } from "../locations/location.types";

type KitchenWorkflowMode = "PRINT_ONLY" | "PRINT_AND_SCREEN";

type LocationKitchenSettings = Readonly<{
  businessId: string;
  locationId: string;
  workflowMode: KitchenWorkflowMode;
  isConfigured: boolean;
  location: Readonly<{
    id: string;
    code: string;
    name: string;
    locationType: LocationType;
    isActive: boolean;
  }>;
  createdAt: Date | null;
  updatedAt: Date | null;
}>;

export type { KitchenWorkflowMode, LocationKitchenSettings };
