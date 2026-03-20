import { PartialType } from '@nestjs/swagger';
import { CreateDivisaoDto } from './create-divisao.dto';

export class UpdateDivisaoDto extends PartialType(CreateDivisaoDto) {}
