import type { RowDataPacket } from "mysql2/promise";

import { databasePool } from "../../../database/pool";

type ComboComponentRow = RowDataPacket & {
  id: string;
  productId: string;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  quantity: string;
  isActive: number;
};

type ComboComponent = Readonly<{
  id: string;
  productId: string;
  sku: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  currentPrice: string;
  quantity: string;
  isActive: boolean;
}>;

const findComboComponents = async (
  businessId: string,
  comboProductId: string,
): Promise<ComboComponent[]> => {
  const [rows] = await databasePool.execute<ComboComponentRow[]>(
    `
        SELECT
          CAST(pcc.id AS CHAR) AS id,
          CAST(pcc.component_product_id AS CHAR)
            AS productId,
          p.sku,
          p.name,
          p.description,
          p.image_url AS imageUrl,
          CAST(p.current_price AS CHAR)
            AS currentPrice,
          CAST(pcc.quantity AS CHAR)
            AS quantity,
          p.is_active AS isActive
        FROM product_combo_components AS pcc
        INNER JOIN products AS p
          ON p.business_id = pcc.business_id
          AND p.id = pcc.component_product_id
        WHERE
          pcc.business_id = ?
          AND pcc.combo_product_id = ?
        ORDER BY
          pcc.id ASC
      `,
    [businessId, comboProductId],
  );

  return rows.map((row) => ({
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    currentPrice: row.currentPrice,
    quantity: row.quantity,
    isActive: Boolean(row.isActive),
  }));
};

export { findComboComponents };
export type { ComboComponent };
