import { Workbook } from "exceljs";

import { databasePool } from "../../../database/pool";
import { AppError } from "../../../shared/errors/app-error";
import {
  findSalesExportRows,
  MAX_SALES_EXPORT_ROWS,
} from "../repositories/sales-export.repository";
import { findSalesProfitability } from "../repositories/sales-profitability.repository";
import type { SalesReportQuery } from "../schemas/sales-report.schema";
import { resolveSalesReportContext } from "./sales-report.service";

const MONEY_FORMAT = "#,##0.00####";

const serviceLabels: Record<string, string> = {
  TABLE: "Mesa",
  TAKEAWAY: "Para recoger",
  DELIVERY: "Domicilio",
};

const sourceLabels: Record<string, string> = {
  IN_PERSON: "Presencial",
  WHATSAPP: "WhatsApp",
  PHONE: "Teléfono",
  PUBLIC_MENU: "Menú público",
};

const statusLabels: Record<string, string> = {
  COMPLETED: "Completada",
  PARTIALLY_REFUNDED: "Devuelta parcialmente",
  REFUNDED: "Devuelta totalmente",
};

const toExcelAmount = (value: string | null): number | string | null => {
  if (value === null) {
    return null;
  }

  const significantDigits = value.replace(/[-.]/g, "").replace(/^0+|0+$/g, "");

  // Excel conserva hasta 15 dígitos significativos en celdas numéricas.
  return significantDigits.length <= 15 ? Number(value) : value;
};

const readExportData = async (
  businessId: string,
  filters: Awaited<ReturnType<typeof resolveSalesReportContext>>["filters"],
) => {
  const connection = await databasePool.getConnection();

  try {
    await connection.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ");
    await connection.query("START TRANSACTION READ ONLY");

    const sales = await findSalesExportRows(connection, businessId, filters);

    if (sales.length > MAX_SALES_EXPORT_ROWS) {
      throw new AppError(
        "El reporte supera 20.000 ventas. Reduce el periodo o aplica más filtros.",
        422,
        "SALES_EXPORT_LIMIT_EXCEEDED",
      );
    }

    const profitability = await findSalesProfitability(
      businessId,
      filters,
      connection,
    );

    await connection.commit();
    return { sales, profitability };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const exportSalesReport = async (
  businessId: string,
  query: SalesReportQuery,
): Promise<Buffer> => {
  const { business, scope, period, filters } = await resolveSalesReportContext(
    businessId,
    query,
  );
  const { sales, profitability } = await readExportData(businessId, filters);

  const workbook = new Workbook();
  const summary = workbook.addWorksheet("Resumen");

  summary.getColumn(1).width = 40;
  summary.getColumn(2).width = 38;

  summary.addRow(["Reporte de ventas", business.name]).font = { bold: true };
  summary.addRow(["Desde", period.from]);
  summary.addRow(["Hasta", period.to]);
  summary.addRow(["Zona horaria", period.timezone]);
  summary.addRow(["Moneda", business.currencyCode]);
  summary.addRow(["Sede", scope.location?.name ?? "Todas"]);
  summary.addRow([
    "Tipo de servicio",
    query.serviceType ? serviceLabels[query.serviceType] : "Todos",
  ]);
  summary.addRow([
    "Canal de origen",
    query.sourceChannel ? sourceLabels[query.sourceChannel] : "Todos",
  ]);
  summary.addRow(["Abierto por (ID)", query.openedByMembershipId ?? "Todos"]);
  summary.addRow(["Ventas incluidas", sales.length]);
  summary.addRow([]);

  const amounts = [
    [
      "Ventas sin impuestos antes de devoluciones",
      profitability.netSalesBeforeRefunds,
    ],
    ["Devoluciones sin impuestos", profitability.refundedNetAmount],
    ["Ventas efectivas sin impuestos", profitability.effectiveNetSales],
    ["Costo de productos vendidos", profitability.costOfGoodsSold],
    ["Utilidad bruta", profitability.grossProfit],
  ] as const;

  for (const [label, value] of amounts) {
    const row = summary.addRow([label, toExcelAmount(value)]);
    row.getCell(2).numFmt = MONEY_FORMAT;
  }

  const margin = summary.addRow([
    "Margen bruto",
    profitability.grossMarginPercentage === null
      ? null
      : Number(profitability.grossMarginPercentage) / 100,
  ]);
  margin.getCell(2).numFmt = "0.00%";

  summary.addRow([
    "Líneas sin costo conocido",
    profitability.unknownCostLineCount,
  ]);
  summary.addRow(["Base del periodo", "Fecha de venta. Excluye anuladas."]);

  if (profitability.unknownCostLineCount > 0) {
    const coverageRow = summary.addRow([
      "Cobertura de costos",
      "Costo, utilidad y margen sin calcular por datos faltantes.",
    ]);

    coverageRow.getCell(2).alignment = { wrapText: true };
    coverageRow.height = 32;
  }

  const detail = workbook.addWorksheet("Ventas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  detail.columns = [
    { header: "ID venta", width: 22, style: { numFmt: "@" } },
    { header: "ID pedido", width: 22, style: { numFmt: "@" } },
    {
      header: "Fecha de venta",
      width: 24,
      style: { numFmt: "dd/mm/yyyy hh:mm:ss" },
    },
    { header: "Sede", width: 30 },
    { header: "Servicio", width: 18 },
    { header: "Origen", width: 18 },
    { header: "Estado", width: 27 },
    { header: "Moneda", width: 12 },
    {
      header: "Venta sin impuestos",
      width: 24,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Devuelto sin impuestos",
      width: 26,
      style: { numFmt: MONEY_FORMAT },
    },
    {
      header: "Efectivo sin impuestos",
      width: 26,
      style: { numFmt: MONEY_FORMAT },
    },
  ];

  const localDateFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: period.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (const sale of sales) {
    const parts = new Map(
      localDateFormat
        .formatToParts(new Date(sale.soldAtUtc))
        .map(({ type, value }) => [type, value]),
    );
    const localExcelDate = new Date(
      `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}T` +
        `${parts.get("hour")}:${parts.get("minute")}:${parts.get("second")}Z`,
    );

    detail.addRow([
      sale.saleId,
      sale.orderId,
      localExcelDate,
      sale.locationName,
      serviceLabels[sale.serviceType] ?? sale.serviceType,
      sourceLabels[sale.sourceChannel] ?? sale.sourceChannel,
      statusLabels[sale.status] ?? sale.status,
      sale.currencyCode,
      toExcelAmount(sale.netBeforeRefunds),
      toExcelAmount(sale.refundedNet),
      toExcelAmount(sale.effectiveNet),
    ]);
  }

  detail.getRow(1).font = { bold: true };
  detail.autoFilter = `A1:K${sales.length + 1}`;

  return Buffer.from(await workbook.xlsx.writeBuffer());
};

export { exportSalesReport };
