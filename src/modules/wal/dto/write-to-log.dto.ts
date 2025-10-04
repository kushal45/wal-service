import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
  IsNotEmpty,
  IsArray,
  IsNumber,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TargetConfigDto } from './target-config.dto';
import { LifecycleConfigDto } from './lifecycle-config.dto';

export class WriteToLogDto {
  @ApiProperty({
    description: 'Namespace identifier for WAL configuration',
    example: 'user-cache-replication',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  namespace: string;

  @ApiPropertyOptional({
    description: 'Lifecycle configuration for message processing',
    type: LifecycleConfigDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => LifecycleConfigDto)
  lifecycle?: LifecycleConfigDto;

  @ApiProperty({
    description: 'Message payload to be processed',
    example: {
      operation: 'SET',
      key: 'user:123',
      value: { name: 'John Doe', email: 'john@example.com' },
    },
  })
  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;

  @ApiProperty({
    description: 'Target configuration for message destination',
    example: {
      type: 'cache',
      config: {
        operation: 'SET',
        regions: ['us-east-1', 'eu-west-1'],
      },
    },
  })
  @ValidateNested({ each: true })
  @Type(() => TargetConfigDto)
  target: TargetConfigDto | TargetConfigDto[];

  @ApiPropertyOptional({
    description: 'Additional metadata for message processing',
    example: {
      'user-id': '123',
      'trace-id': 'abc-def-ghi',
      'correlation-id': 'req-456-789',
    },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Message priority (1-10, higher number = higher priority)',
    example: 5,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : (value as number),
  )
  priority?: number;

  @ApiPropertyOptional({
    description: 'Tags for message categorization and filtering',
    example: ['user-operation', 'cache-update', 'priority-medium'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
