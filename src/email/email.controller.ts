import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Request,
} from '@nestjs/common';
import { ApiBody, ApiTags } from '@nestjs/swagger';
import { Permissoes } from 'src/auth/decorators/permissoes.decorator';
import { transporter } from 'src/lib/nodemailer';

class PreviewSendDto {
  para: string;
  assunto: string;
  html: string;
}

@ApiTags('Email')
@Controller('email')
export class EmailController {
  @Post('preview-send')
  @Permissoes('DEV')
  @ApiBody({ type: PreviewSendDto })
  async previewSend(
    @Body() body: PreviewSendDto,
    @Request() req: { user?: { permissao?: string } },
  ): Promise<{ ok: boolean; mensagem: string }> {
    const para = body.para?.trim().toLowerCase();
    if (!para || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(para)) {
      throw new BadRequestException('E-mail de destino inválido.');
    }
    if (!body.html?.trim()) {
      throw new BadRequestException('HTML do e-mail não pode ser vazio.');
    }

    const from =
      process.env.MAIL_FROM || 'noreply@prefeitura.sp.gov.br';

    await transporter.sendMail({
      from,
      to: para,
      subject: `[TESTE] ${body.assunto || 'Preview de e-mail'}`,
      html: body.html,
      text: 'Este é um e-mail de teste enviado via tela de preview de e-mails (DEV).',
    });

    return { ok: true, mensagem: `E-mail de teste enviado para ${para}.` };
  }
}
