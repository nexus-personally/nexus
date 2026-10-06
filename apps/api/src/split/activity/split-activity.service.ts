import { Inject, Injectable } from '@nestjs/common';
import { SplitGroupsService } from '../groups/split-groups.service.js';
import { SPLIT_REPOSITORY, type SplitRepository } from '../persistence/split.repository.js';
@Injectable()
export class SplitActivityService {
 constructor(private groups:SplitGroupsService,@Inject(SPLIT_REPOSITORY) private repository:SplitRepository){}
 async list(userId:string,groupId:string,cursor?:string){await this.groups.access(userId,groupId);const before=cursor?new Date(cursor):null;const limit=30;const items=await this.repository.listActivity(groupId,before,limit+1);const hasMore=items.length>limit;const page=items.slice(0,limit);return{items:page,nextCursor:hasMore?page.at(-1)!.createdAt.toISOString():null};}
}
