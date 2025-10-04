import {
  IsString,
  IsEnum,
  IsObject,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TargetType {
  DATABASE = 'database',
  CACHE = 'cache',
  HTTP_SERVICE = 'http',
  GRPC_SERVICE = 'grpc',
  QUEUE = 'queue',
  FILE_SYSTEM = 'file_system',
  WEBHOOK = 'webhook',
}

export class TargetConfigDto {
  @ApiProperty({
    description: 'Type of target system',
    enum: TargetType,
    example: TargetType.CACHE,
  })
  @IsEnum(TargetType)
  type: TargetType;

  @ApiProperty({
    description: 'Target identifier or name',
    example: 'user-cache-primary',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    description: 'Target-specific configuration',
    example: {
      operation: 'SET',
      regions: ['us-east-1', 'eu-west-1'],
      host: 'redis.example.com',
      port: 6379,
      database: 0,
    },
  })
  @IsObject()
  @IsNotEmpty()
  config: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Target region for cross-region operations',
    example: 'us-east-1',
  })
  @IsOptional()
  @IsString()
  region?: string;

  @ApiPropertyOptional({
    description: 'Target weight for load balancing (0-100)',
    example: 100,
    minimum: 0,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : (value as number),
  )
  weight?: number;

  @ApiPropertyOptional({
    description: 'Enable target for processing',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Target-specific tags',
    example: ['primary', 'high-availability'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
