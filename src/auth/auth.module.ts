import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ValidarLoginMiddleware } from './middlewares/validar-login.middleware';
import { RtStrategy } from './strategies/rt.strategy';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { LdapExternoModule } from 'src/ldap-externo/ldap-externo.module';

@Module({
  controllers: [AuthController],
  providers: [AuthService, UsuariosService, LocalStrategy, JwtStrategy, RtStrategy],
  imports: [
    UsuariosModule,
    LdapExternoModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '1d',
      },
    }),
  ],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ValidarLoginMiddleware).forRoutes('login');
  }
}
