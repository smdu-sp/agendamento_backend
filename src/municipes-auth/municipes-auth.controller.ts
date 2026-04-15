import { Body, Controller, Post } from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { IsPublic } from 'src/auth/decorators/is-public.decorator';
import { CadastroMunicipeDto } from './dto/cadastro-municipe.dto';
import { LoginMunicipeDto } from './dto/login-municipe.dto';
import { SolicitarRedefinicaoSenhaDto } from './dto/solicitar-redefinicao-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { MunicipesAuthService } from './municipes-auth.service';
import {
  MunicipeTokenResponseDto,
  SolicitarRedefinicaoResponseDto,
} from './dto/municipes-auth-response.dto';

@ApiTags('Munícipes Auth')
@Controller('municipes/auth')
export class MunicipesAuthController {
  constructor(private readonly service: MunicipesAuthService) {}

  @Post('cadastro')
  @IsPublic()
  @ApiBody({ type: CadastroMunicipeDto })
  cadastro(@Body() dto: CadastroMunicipeDto): Promise<MunicipeTokenResponseDto> {
    return this.service.cadastrar(dto);
  }

  @Post('login')
  @IsPublic()
  @ApiBody({ type: LoginMunicipeDto })
  login(@Body() dto: LoginMunicipeDto): Promise<MunicipeTokenResponseDto> {
    return this.service.login(dto);
  }

  @Post('solicitar-redefinicao-senha')
  @IsPublic()
  @ApiBody({ type: SolicitarRedefinicaoSenhaDto })
  solicitarRedefinicaoSenha(
    @Body() dto: SolicitarRedefinicaoSenhaDto,
  ): Promise<SolicitarRedefinicaoResponseDto> {
    return this.service.solicitarRedefinicaoSenha(dto);
  }

  @Post('redefinir-senha')
  @IsPublic()
  @ApiBody({ type: RedefinirSenhaDto })
  redefinirSenha(@Body() dto: RedefinirSenhaDto): Promise<{ mensagem: string }> {
    return this.service.redefinirSenha(dto);
  }
}
