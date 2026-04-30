import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

type JoinPayload = {
  referencia?: string;
};

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGIN || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
})
export class PreProjetoChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(PreProjetoChatGateway.name);

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    this.logger.debug(`Socket conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket desconectado: ${client.id}`);
  }

  @SubscribeMessage('preprojeto:join')
  handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: JoinPayload,
  ) {
    const referencia = payload?.referencia?.trim();
    if (!referencia) return;
    client.join(this.room(referencia));
  }

  publicarAtualizacao(payload: { id?: string; protocolo?: string }) {
    const id = payload.id?.trim();
    const protocolo = payload.protocolo?.trim();
    const body = { atualizadoEm: new Date().toISOString() };

    if (id) {
      this.server.to(this.room(id)).emit('preprojeto:atualizado', body);
    }
    if (protocolo) {
      this.server.to(this.room(protocolo)).emit('preprojeto:atualizado', body);
    }
  }

  private room(referencia: string) {
    return `preprojeto:${referencia}`;
  }
}
