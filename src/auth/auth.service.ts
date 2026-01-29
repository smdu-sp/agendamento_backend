import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { Usuario } from '@prisma/client';
import { UsuarioPayload } from './models/UsuarioPayload';
import { JwtService } from '@nestjs/jwt';
import { UsuarioToken } from './models/UsuarioToken';
import { UsuarioJwt } from './models/UsuarioJwt';
import { Client as LdapClient } from 'ldapts';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  async login(usuario: Usuario): Promise<UsuarioToken> {
    const { access_token, refresh_token } = await this.getTokens(usuario);
    return { access_token, refresh_token };
  }

  async refresh(usuario: Usuario) {
    const { access_token, refresh_token } = await this.getTokens(usuario);
    return { access_token, refresh_token };
  }

  async getTokens(usuario: UsuarioJwt) {
    const { id, login, nome, nomeSocial, email, status, avatar, permissao } =
      usuario;
    const payload: UsuarioPayload = {
      sub: id,
      login,
      nome,
      nomeSocial,
      email,
      status,
      avatar,
      permissao,
    };
    const access_token = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
      secret: process.env.JWT_SECRET,
    });
    const refresh_token = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
      secret: process.env.RT_SECRET,
    });
    return { access_token, refresh_token };
  }

  async validateUser(login: string, senha: string): Promise<Usuario> {
    const usuario = await this.usuariosService.buscarPorLogin(login);
    if (!usuario) throw new UnauthorizedException('Credenciais incorretas.');
    if (usuario.status === false)
      throw new UnauthorizedException('Usuário desativado.');

    // Usuários com senha (ex: Portaria): apenas autenticação local
    if (usuario.senha) {
      const ok = await bcrypt.compare(senha, usuario.senha);
      if (!ok) throw new UnauthorizedException('Credenciais incorretas.');
      return usuario;
    }

    // Ambiente local: ignora LDAP
    if (process.env.ENVIRONMENT === 'local') return usuario;

    // Autenticação LDAP
    const client = new LdapClient({ url: process.env.LDAP_SERVER });
    try {
      await client.bind(`${login}${process.env.LDAP_DOMAIN}`, senha);
      await client.unbind();
      return usuario;
    } catch {
      throw new UnauthorizedException('Credenciais incorretas.');
    }
  }
}
