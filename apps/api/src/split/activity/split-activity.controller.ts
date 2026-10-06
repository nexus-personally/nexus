import { Controller,Get,Param,Query,UseGuards } from '@nestjs/common';
import { CurrentSplitSession } from '../auth/current-split-user.decorator.js';import { SplitAuthGuard } from '../auth/split-auth.guard.js';import { SplitOriginGuard } from '../auth/split-origin.guard.js';import type { SplitAuthenticatedSession } from '../auth/split-auth.types.js';import { SplitActivityService } from './split-activity.service.js';
@Controller('split/groups/:groupId/activity') @UseGuards(SplitOriginGuard,SplitAuthGuard)
export class SplitActivityController{constructor(private activity:SplitActivityService){}@Get()list(@CurrentSplitSession()s:SplitAuthenticatedSession,@Param('groupId')g:string,@Query('cursor')c?:string){return this.activity.list(s.user.id,g,c);}}
