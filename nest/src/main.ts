import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { AppModule } from './app.module.js'
import { GlobalExceptionFilter } from './common/exception.filter.js'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.enableCors({ origin: true, credentials: true })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  app.useGlobalFilters(new GlobalExceptionFilter())

  await app.listen(process.env.PORT ?? 3000)
  console.log(`NestJS listening on http://localhost:${process.env.PORT ?? 3000}`)
}
await bootstrap()
