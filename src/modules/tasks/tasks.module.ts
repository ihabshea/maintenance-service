import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { AuditModule } from '../audit/audit.module';
import { ReferenceModule } from '../reference/reference.module';

@Module({
  imports: [AuditModule, ReferenceModule],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
