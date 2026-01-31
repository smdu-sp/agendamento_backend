
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { stringify } from 'json-bigint';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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
  app.enableCors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3001' });
  const options = new DocumentBuilder()
    .addBearerAuth()
    .setTitle('Atendimento ao Público - Agendamentos')
    .setDescription('Backend em NestJS para aplicação de agendamento de Atendimentos ao Público.',)
    .setVersion('versão 1.0')
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup('', app, document);
  await app.listen(port);
  console.log("API outorga rodando em http://localhost:" + port);
  console.log("SwaggerUI rodando em http://localhost:" + port + "/api");

}
bootstrap();
