import type { Server as HttpServer } from "node:http";

import { Server } from "socket.io";

import { environment } from "../config/env";
import { authenticateRealtimeConnection } from "./middlewares/authenticate-realtime.middleware";
import {
  getBusinessRoleRoom,
  getBusinessRoom,
  getMembershipRoom,
} from "./realtime.rooms";
import type {
  ClientToServerEvents,
  InterServerEvents,
  RealtimeSocket,
  ServerToClientEvents,
  SocketData,
} from "./realtime.types";

type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let realtimeServer: RealtimeServer | null = null;

const handleRealtimeConnection = async (
  socket: RealtimeSocket,
): Promise<void> => {
  const { auth } = socket.data;

  const rooms = [
    getBusinessRoom(auth.businessId),
    getMembershipRoom(auth.membershipId),
    ...auth.roles.map((role) => getBusinessRoleRoom(auth.businessId, role)),
  ];

  await socket.join(rooms);

  socket.emit("session:ready", {
    userId: auth.userId,
    businessId: auth.businessId,
    membershipId: auth.membershipId,
    roles: auth.roles,
    connectedAt: new Date().toISOString(),
  });

  socket.on("session:ping", (acknowledge) => {
    acknowledge({
      serverTime: new Date().toISOString(),
    });
  });

  console.log(
    `Socket conectado: membership=${auth.membershipId}, business=${auth.businessId}`,
  );

  socket.on("disconnect", (reason) => {
    console.log(
      `Socket desconectado: membership=${auth.membershipId}, reason=${reason}`,
    );
  });
};

const initializeRealtimeServer = (httpServer: HttpServer): RealtimeServer => {
  if (realtimeServer) {
    return realtimeServer;
  }

  realtimeServer = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(httpServer, {
    cors: {
      origin: environment.CLIENT_ORIGIN,
      methods: ["GET", "POST"],
    },
  });

  realtimeServer.use((socket, next) => {
    void authenticateRealtimeConnection(socket, next);
  });

  realtimeServer.on("connection", (socket) => {
    void handleRealtimeConnection(socket);
  });

  return realtimeServer;
};

const getRealtimeServer = (): RealtimeServer => {
  if (!realtimeServer) {
    throw new Error("El servidor de tiempo real todavía no fue inicializado");
  }

  return realtimeServer;
};

export { getRealtimeServer, initializeRealtimeServer };
export type { RealtimeServer };
