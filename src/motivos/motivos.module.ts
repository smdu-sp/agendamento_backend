import { Module } from '@nestjs/common';
import { MotivosService } from './motivos.service';
import { MotivosController } from './motivos.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MotivosController],
  providers: [MotivosService],
  exports: [MotivosService],
})
export class MotivosModule {}
