import { Module } from '@nestjs/common';
import { DivisoesService } from './divisoes.service';
import { DivisoesController } from './divisoes.controller';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DivisoesController],
  providers: [DivisoesService],
  exports: [DivisoesService],
})
export class DivisoesModule {}
