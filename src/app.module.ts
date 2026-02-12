import { Global, Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { CoordenadoriasModule } from './coordenadorias/coordenadorias.module';
import { AgendamentosModule } from './agendamentos/agendamentos.module';
import { MotivosModule } from './motivos/motivos.module';
import { TiposAgendamentoModule } from './tipos-agendamento/tipos-agendamento.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { ImpersonationGuard } from './auth/guards/impersonation.guard';
import { RoleGuard } from './auth/guards/role.guard';

@Global()
@Module({
  exports: [AppService],
  imports: [PrismaModule, AuthModule, UsuariosModule, CoordenadoriasModule, AgendamentosModule, MotivosModule, TiposAgendamentoModule],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ImpersonationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RoleGuard,
    },
  ],
})
export class AppModule {}