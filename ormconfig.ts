import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'password',
  database: process.env.DATABASE_NAME || 'wal_service',
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/database/migrations/*{.ts,.js}'],
  synchronize: false, // Always false for production safety
  logging: process.env.DATABASE_LOGGING === 'true',
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});