import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { stringify } from 'json-bigint';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Aplicação roda atrás de reverse proxy/load balancer em produção.
  // Sem isso, req.ip resolve sempre para o IP do proxy, colapsando o
  // rate limiting (ThrottlerGuard) num único balde compartilhado por
  // todos os usuários. Ajuste o número de hops se a topologia mudar.
  app.set('trust proxy', 1);
  app.useGlobalPipes(new ValidationPipe());
  app.use((req, res, next) => {
    res.json = (data) => {
      return res.send(stringify(data));
    };
    next();
  });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));
  const port = process.env.PORT || 3000;
  const corsEnv = process.env.CORS_ORIGIN;
  const corsOrigin = corsEnv
    ? corsEnv.split(',').map((o) => o.trim())
    : ['http://localhost:3001', 'http://localhost:3000'];
  app.enableCors({ origin: corsOrigin });
  if (process.env.ENVIRONMENT === 'local') {
    const options = new DocumentBuilder()
      .addBearerAuth()
      .setTitle('Atendimento ao Público - Agendamentos')
      .setDescription('Backend em NestJS para aplicação de agendamento de Atendimentos ao Público.',)
      .setVersion('versão 1.0')
      .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup('', app, document);
  }
  await app.listen(port, '0.0.0.0');
  console.log("API outorga rodando em http://localhost:" + port);
  console.log("SwaggerUI rodando em http://localhost:" + port + "/api");

}
bootstrap();
