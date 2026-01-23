import { Module } from '@nestjs/common';
import { CoordenadoriasService } from './coordenadorias.service';
import { CoordenadoriasController } from './coordenadorias.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CoordenadoriasController],
  providers: [CoordenadoriasService],
  exports: [CoordenadoriasService],
})
export class CoordenadoriasModule {}
