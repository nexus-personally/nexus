import assert from 'node:assert/strict';
import test from 'node:test';
import { SplitSettlementsService } from './split-settlements.service.js';
const now=new Date('2026-10-06T00:00:00Z');let sequence=0;
const access={group:{baseCurrency:'MYR'},membership:{role:'member'}};
const members=[{id:'john'},{id:'samuel'}];
const balances={baseCurrency:'MYR',simplifyDebtsEnabled:true,simplifiedDebts:[{fromMemberId:'john',toMemberId:'samuel',amountMinor:800}],directDebts:[]};
const errorCode=async(work:()=>Promise<unknown>)=>{try{await work();assert.fail();}catch(error){return (error as any).getResponse().error.code;}};
test('member records a partial base-currency settlement transactionally',async()=>{
 let write:any;const service=new SplitSettlementsService({access:async()=>access,requireActive:()=>{}} as never,{get:async()=>balances} as never,{listMembers:async()=>members,createSettlement:async(value:any)=>(write=value,value.settlement)} as never,{now:()=>now,uuid:()=>`id-${++sequence}`,token:()=>''});
 const result=await service.create('user','group',{fromMemberId:'john',toMemberId:'samuel',amountMinor:500,paymentMethod:'duitnow',settlementDate:'2026-10-06',note:'Partial'});
 assert.equal(result.currency,'MYR');assert.equal(result.amountMinor,500);assert.ok(write.activityId);
});
test('settlement rejects overpayment, zero and cross-group member IDs',async()=>{
 const service=new SplitSettlementsService({access:async()=>access,requireActive:()=>{}} as never,{get:async()=>balances} as never,{listMembers:async()=>members} as never,{now:()=>now,uuid:()=>'',token:()=>''});
 const base={fromMemberId:'john',toMemberId:'samuel',amountMinor:801,paymentMethod:'cash',settlementDate:'2026-10-06'};
 assert.equal(await errorCode(()=>service.create('user','group',base)),'SPLIT_SETTLEMENT_EXCEEDS_OUTSTANDING');
 assert.equal(await errorCode(()=>service.create('user','group',{...base,amountMinor:0})),'SPLIT_SETTLEMENT_AMOUNT_INVALID');
 assert.equal(await errorCode(()=>service.create('user','group',{...base,amountMinor:100,toMemberId:'other'})),'SPLIT_SETTLEMENT_MEMBERS_INVALID');
});
