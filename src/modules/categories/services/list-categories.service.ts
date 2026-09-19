import type { Category } from "../category.types";
import { findCategoriesByBusinessId } from "../repositories/category.repository";

const listCategories = async (businessId: string): Promise<Category[]> =>
  findCategoriesByBusinessId(businessId);

export { listCategories };
