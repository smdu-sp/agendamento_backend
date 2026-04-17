import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AgendamentosService } from './agendamentos.service';
import { AgendamentosController } from './agendamentos.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { CoordenadoriasModule } from 'src/coordenadorias/coordenadorias.module';
import { MunicipeJwtAuthGuard } from 'src/auth/guards/municipe-jwt-auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    PrismaModule,
    UsuariosModule,
    CoordenadoriasModule,
  ],
  controllers: [AgendamentosController],
  providers: [AgendamentosService, MunicipeJwtAuthGuard],
  exports: [AgendamentosService],
})
export class AgendamentosModule {}
