import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../../app.module';
import { DatabaseService } from '../database.service';

// Regenerates the sample database: npm run db:seed -- --count 1000 --seed 42
async function main() {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? Number(process.argv[i + 1]) : undefined;
  };

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['log', 'warn', 'error'] });
  app.get(DatabaseService).reset({ count: arg('count'), seed: arg('seed') });
  await app.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
