import { IsOptional, IsNumber, IsObject, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LifecycleConfigDto {
  @ApiPropertyOptional({
    description: 'Delay in seconds before processing',
    example: 300,
    minimum: 0,
    maximum: 86400,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(86400)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? parseInt(value, 10) : (value as number),
  )
  delay?: number;

  @ApiPropertyOptional({
    description: 'Retry policy configuration',
  })
  @IsOptional()
  @IsObject()
  retryPolicy?: {
    maxAttempts?: number;
    backoffStrategy?: 'exponential' | 'linear' | 'constant';
    backoffMultiplier?: number;
    maxDelay?: number;
  };
}
