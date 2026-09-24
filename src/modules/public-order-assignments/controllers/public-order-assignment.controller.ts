import type { RequestHandler } from "express";

import { AppError } from "../../../shared/errors/app-error";
import {
  publicOrderAssignmentIdParamsSchema,
  savePublicOrderAssignmentSchema,
  updatePublicOrderAssignmentStatusSchema,
} from "../schemas/public-order-assignment.schema";
import {
  changePublicOrderAssignmentStatus,
  createPublicOrderAssignment,
  listPublicOrderAssignments,
  updatePublicOrderAssignment,
} from "../services/public-order-assignment.service";

const createPublicOrderAssignmentController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const input = savePublicOrderAssignmentSchema.parse(request.body);

  const assignment = await createPublicOrderAssignment(
    request.auth.businessId,
    request.auth.membershipId,
    input,
  );

  response.status(201).json({
    status: "success",
    data: {
      assignment,
    },
  });
};

const listPublicOrderAssignmentsController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const assignments = await listPublicOrderAssignments(request.auth.businessId);

  response.status(200).json({
    status: "success",
    data: {
      assignments,
    },
  });
};

const updatePublicOrderAssignmentController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { assignmentId } = publicOrderAssignmentIdParamsSchema.parse(
    request.params,
  );

  const input = savePublicOrderAssignmentSchema.parse(request.body);

  const assignment = await updatePublicOrderAssignment(
    request.auth.businessId,
    assignmentId,
    input,
  );

  response.status(200).json({
    status: "success",
    data: {
      assignment,
    },
  });
};

const updatePublicOrderAssignmentStatusController: RequestHandler = async (
  request,
  response,
) => {
  if (!request.auth) {
    throw new AppError(
      "Se requiere autenticación",
      401,
      "AUTHENTICATION_REQUIRED",
    );
  }

  const { assignmentId } = publicOrderAssignmentIdParamsSchema.parse(
    request.params,
  );

  const { isActive } = updatePublicOrderAssignmentStatusSchema.parse(
    request.body,
  );

  const assignment = await changePublicOrderAssignmentStatus(
    request.auth.businessId,
    assignmentId,
    isActive,
  );

  response.status(200).json({
    status: "success",
    data: {
      assignment,
    },
  });
};

export {
  createPublicOrderAssignmentController,
  listPublicOrderAssignmentsController,
  updatePublicOrderAssignmentController,
  updatePublicOrderAssignmentStatusController,
};
