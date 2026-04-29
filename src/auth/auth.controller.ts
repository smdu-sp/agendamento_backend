import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Request,
  Get,
  Body,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { AuthRequest } from './models/AuthRequest';
import { IsPublic } from './decorators/is-public.decorator';
import { UsuarioAtual } from './decorators/usuario-atual.decorator';
import { Usuario } from '@prisma/client';
import { RefreshAuthGuard } from './guards/refresh.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsuarioToken } from './models/UsuarioToken';
import { LoginDto } from './models/login.dto';
import { EuResponseDTO } from './models/eu-response.dto';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { UsuarioResponseDTO } from 'src/usuarios/dto/usuario-response.dto';

@ApiBearerAuth()
@ApiTags('Auth')
@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usuariosService: UsuariosService
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiBody({
    description: 'Senha e login para autenticação por JWT.',
    type: LoginDto,
  })
  @UseGuards(LocalAuthGuard)
  @IsPublic()
  login(@Request() req: AuthRequest): Promise<UsuarioToken> {
    return this.authService.login(req.user);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @IsPublic()
  @UseGuards(RefreshAuthGuard)
  refresh(@UsuarioAtual() usuario: Usuario): Promise<UsuarioToken> {
    return this.authService.refresh(usuario);
  }

  @Get('eu')
  @ApiResponse({
    status: 200,
    description: 'Retorna 200 se o sistema encontrar o usuário logado.',
    type: UsuarioResponseDTO,
  })
  usuarioAtual(@UsuarioAtual() usuario: Usuario) {
    return this.usuariosService.buscarPorId(usuario.id);
  }

  @Get('debug/time')
  @IsPublic()
  debugTime() {
    const now = new Date();
    return {
      iso: now.toISOString(),
      utcOffset: -now.getTimezoneOffset() / 60,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  }
}
