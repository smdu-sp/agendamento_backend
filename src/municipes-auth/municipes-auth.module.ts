import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MunicipesAuthController } from './municipes-auth.controller';
import { MunicipesAuthService } from './municipes-auth.service';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [
    EmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '7d',
      },
    }),
  ],
  controllers: [MunicipesAuthController],
  providers: [MunicipesAuthService],
})
export class MunicipesAuthModule {}
