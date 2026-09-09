import { Module } from '@nestjs/common';
import { LdapExternoService } from './ldap-externo.service';

@Module({
  providers: [LdapExternoService],
  exports: [LdapExternoService],
})
export class LdapExternoModule {}
