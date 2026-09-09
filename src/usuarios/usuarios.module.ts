import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { LdapExternoModule } from 'src/ldap-externo/ldap-externo.module';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
  exports: [UsuariosService],
  imports: [LdapExternoModule],
})
export class UsuariosModule {}
