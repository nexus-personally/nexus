import assert from 'node:assert/strict';
import test from 'node:test';
import { SplitSettlementsService } from './split-settlements.service.js';
const now=new Date('2026-10-06T00:00:00Z');let sequence=0;
const access={group:{baseCurrency:'MYR'},membership:{role:'member'}};
const members=[{id:'john'},{id:'samuel'}];
const balances={simplifyDebtsEnabled:true,simplifiedDebts:[{fromMemberId:'john',toMemberId:'samuel',amountMinor:800}],directDebts:[]};
const errorCode=async(work:()=>Promise<unknown>)=>{try{await work();assert.fail();}catch(error){return (error as any).getResponse().error.code;}};
test('member records a partial base-currency settlement transactionally',async()=>{
 let write:any;const service=new SplitSettlementsService({access:async()=>access,requireActive:()=>{}} as never,{listMembers:async()=>members,createSettlement:async(value:any,_idempotency:any,validate:any)=>(write=value,validate(balances),value.settlement)} as never,{now:()=>now,uuid:()=>`id-${++sequence}`,token:()=>''});
 const result=await service.create('user','group',{fromMemberId:'john',toMemberId:'samuel',amountMinor:500,paymentMethod:'duitnow',settlementDate:'2026-10-06',note:'Partial'},'settlement-create-0001');
 assert.equal(result.currency,'MYR');assert.equal(result.amountMinor,500);assert.ok(write.activityId);
});
test('settlement rejects overpayment, zero and cross-group member IDs',async()=>{
 const service=new SplitSettlementsService({access:async()=>access,requireActive:()=>{}} as never,{listMembers:async()=>members,createSettlement:async(_value:any,_idempotency:any,validate:any)=>{validate(balances);return _value.settlement;}} as never,{now:()=>now,uuid:()=>'',token:()=>''});
 const base={fromMemberId:'john',toMemberId:'samuel',amountMinor:801,paymentMethod:'cash',settlementDate:'2026-10-06'};
 assert.equal(await errorCode(()=>service.create('user','group',base,'settlement-create-0002')),'SPLIT_SETTLEMENT_EXCEEDS_OUTSTANDING');
 assert.equal(await errorCode(()=>service.create('user','group',{...base,amountMinor:0},'settlement-create-0003')),'SPLIT_SETTLEMENT_AMOUNT_INVALID');
 assert.equal(await errorCode(()=>service.create('user','group',{...base,amountMinor:100,toMemberId:'other'},'settlement-create-0004')),'SPLIT_SETTLEMENT_MEMBERS_INVALID');
});

test('simultaneous settlement attempts revalidate against the serialized current balance', async () => {
 let remaining=800;let tail=Promise.resolve();
 const repository={
  listMembers:async()=>members,
  createSettlement:async(write:any,_idempotency:any,validate:any)=>{
   let release!:()=>void;
   const previous=tail;
   tail=new Promise<void>((resolve)=>{release=resolve;});
   await previous;
   try {
    validate({simplifyDebtsEnabled:true,simplifiedDebts:remaining>0?[{fromMemberId:'john',toMemberId:'samuel',amountMinor:remaining}]:[],directDebts:[]});
    remaining-=write.settlement.amountMinor;
    return write.settlement;
   } finally { release(); }
  },
 };
 const service=new SplitSettlementsService({access:async()=>access,requireActive:()=>{}} as never,repository as never,{now:()=>now,uuid:()=>`id-${++sequence}`,token:()=>''});
 const request={fromMemberId:'john',toMemberId:'samuel',amountMinor:500,paymentMethod:'cash',settlementDate:'2026-10-06'};
 const results=await Promise.allSettled([
  service.create('user','group',request,'settlement-race-key-1'),
  service.create('user','group',request,'settlement-race-key-2'),
 ]);
 assert.equal(results.filter((result)=>result.status==='fulfilled').length,1);
 assert.equal(results.filter((result)=>result.status==='rejected').length,1);
 assert.equal(remaining,300);
});
